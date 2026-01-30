"""
Github 热门仓库爬取与每日热点总结服务。
每日 9 点定时：爬取 trending -> 生成 github_trending / github_trending_llm -> 用每日总结提示词生成博客文章。
"""
import asyncio
import json
import logging
import re
from datetime import date, datetime
from typing import Any, Dict, List, Optional

import httpx
from bs4 import BeautifulSoup
from openai import OpenAI
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert

from app.core.database import AsyncSessionLocal
from app.core.config_loader import get_email_config, get_github_trending_config, get_llm_config, get_site_basic_config
from app.models.config import Config
from app.models.github_trending import GitHubTrending, GitHubTrendingLlm
from app.models.post import Post, PostStatus
from app.models.user import User, UserRole
from app.services.email_service import email_service

logger = logging.getLogger(__name__)

TRENDING_URL = "https://github.com/trending"
_DEFAULT_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; rv:109.0) Gecko/20100101 Firefox/115.0",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.5",
}
_URL_IN_TEXT = re.compile(r"https?://[^\s\)\]\'\"<>]+", re.IGNORECASE)


def _parse_int(s: str) -> Optional[int]:
    if not s:
        return None
    digits = re.sub(r"\D", "", s)
    return int(digits) if digits else None


def fetch_trending_sync() -> List[Dict[str, Any]]:
    """同步爬取 GitHub Trending 页面，返回仓库列表。"""
    resp = httpx.get(TRENDING_URL, follow_redirects=True, headers=_DEFAULT_HEADERS, timeout=30.0)
    resp.raise_for_status()
    soup = BeautifulSoup(resp.text, "html.parser")
    rows = soup.select("article.Box-row") or soup.select("div.Box-row")
    result: List[Dict[str, Any]] = []
    for row in rows:
        title_links = row.select("h2 a, h3 a")
        full_name = None
        for a in title_links:
            href = (a.get("href") or "").strip()
            if href.startswith("/") and href.count("/") >= 2:
                part = href.lstrip("/").split("/")
                if len(part) >= 2 and part[0] and part[1]:
                    full_name = f"{part[0]}/{part[1]}"
                    break
        if not full_name:
            continue
        desc_el = row.select_one("p")
        description = (desc_el.get_text(strip=True) or "").strip() if desc_el else ""
        lang_el = row.select_one('span[itemprop="programmingLanguage"]')
        language = (lang_el.get_text(strip=True) or "").strip() if lang_el else None
        stars, forks = None, None
        for a in row.select("a.Link--muted, a.muted-link"):
            text = a.get_text(strip=True)
            href = (a.get("href") or "").lower()
            num = _parse_int(text)
            if num is None:
                continue
            if "stargazers" in href:
                stars = num
            elif "forks" in href:
                forks = num
        stars_today = None
        row_text = row.get_text(separator=" ", strip=True)
        match = re.search(r"([\d,]+)\s*stars?\s*today", row_text, re.IGNORECASE)
        if match:
            stars_today = _parse_int(match.group(1))
        result.append({
            "full_name": full_name,
            "description": description or None,
            "language": language,
            "stars": stars,
            "forks": forks,
            "stars_today": stars_today,
        })
    return result


def _normalize_website(href: Optional[str]) -> Optional[str]:
    if not href or not (href := str(href).strip()):
        return None
    if href.startswith("http://") or href.startswith("https://"):
        return href
    if "." in href and " " not in href and not href.startswith("/"):
        return "https://" + href
    return None


def fetch_repo_about_sync(full_name: str) -> Dict[str, Any]:
    """同步爬取仓库页 About 区域：官网与标签。"""
    parts = full_name.split("/", 1)
    if len(parts) != 2 or not parts[0] or not parts[1]:
        return {"website": None, "tags": []}
    owner, repo = parts[0], parts[1]
    url = f"https://github.com/{owner}/{repo}"
    try:
        resp = httpx.get(url, follow_redirects=True, headers=_DEFAULT_HEADERS, timeout=15.0)
        resp.raise_for_status()
    except Exception:
        return {"website": None, "tags": []}
    soup = BeautifulSoup(resp.text, "html.parser")
    website = None
    for a in soup.select('a[rel="nofollow"][href^="http"]'):
        href = (a.get("href") or "").strip()
        if "github.com" in href.lower():
            continue
        if 8 < len(href) < 500:
            website = _normalize_website(href)
            break
    if not website:
        for a in soup.select('a[href^="http"]'):
            href = (a.get("href") or "").strip()
            if "github.com" in href.lower() or "twitter.com" in href.lower():
                continue
            parent_text = (a.parent.get_text() if a.parent else "").lower()
            if "about" in parent_text or "website" in parent_text or "homepage" in parent_text:
                website = _normalize_website(href)
                break
    tags: List[str] = []
    for a in soup.select('a[href^="/topics/"]'):
        name = (a.get_text(strip=True) or "").strip()
        if name and name not in tags:
            tags.append(name)
    return {"website": website, "tags": tags}


def _parse_llm_json(content: str) -> dict:
    content = content.strip()
    m = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", content)
    if m:
        content = m.group(1).strip()
    start = content.find("{")
    if start >= 0:
        depth = 0
        for i in range(start, len(content)):
            if content[i] == "{":
                depth += 1
            elif content[i] == "}":
                depth -= 1
                if depth == 0:
                    try:
                        return json.loads(content[start : i + 1])
                    except json.JSONDecodeError:
                        pass
    try:
        return json.loads(content)
    except json.JSONDecodeError:
        return {}


def _extract_url_from_description(desc: str) -> Optional[str]:
    if not desc:
        return None
    for m in _URL_IN_TEXT.finditer(desc):
        url = m.group(0).rstrip(".,;:)")
        if "github.com" in url.lower() or "gitlab.com" in url.lower():
            continue
        if 10 < len(url) < 500:
            return url
    return None


def enrich_repo_with_llm_sync(
    repo: Dict[str, Any],
    llm_config: Dict[str, str],
    project_summary_prompt: str,
) -> Dict[str, Any]:
    """同步：用 LLM 生成仓库介绍。官网、标签优先使用 repo 已有值。"""
    api_key = (llm_config or {}).get("llm_api_key")
    if not api_key:
        return {
            **repo,
            "intro": None,
            "website": repo.get("website"),
            "tags": repo.get("tags") or [],
        }
    base_url = llm_config.get("llm_base_url") or "https://api.openai.com/v1"
    model = llm_config.get("llm_model") or "gpt-4o-mini"
    client = OpenAI(api_key=api_key, base_url=base_url)
    name = repo.get("full_name", "")
    desc = repo.get("description") or ""
    lang = repo.get("language") or ""
    prompt_template = project_summary_prompt.strip() or (
        "你是一个技术文档助手。根据以下 GitHub 仓库信息，写一段**详细、丰富**的中文介绍（intro），"
        "按下面几个方面组织内容，有则展开说明，没有则简要带过或省略该点，整体尽量充实：\n"
        "1. 项目是什么、适合谁用；2. 用到了哪些核心技术；3. 核心原理；4. 解决了什么问题；5. 能给我们带来什么。\n"
        "要求：总长度约 150～400 字，信息准确、避免空泛。\n"
        "仓库名: {name}\n描述: {desc}\n主要语言: {lang}\n"
        "请只返回一个 JSON 对象，格式: {{\"intro\": \"你写的详细介绍全文\"}}"
    )
    prompt = prompt_template.format(name=name, desc=desc, lang=lang)
    try:
        resp = client.chat.completions.create(
            model=model,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.3,
        )
        content = (resp.choices[0].message.content or "").strip()
        data = _parse_llm_json(content)
        intro = data.get("intro")
    except Exception as e:
        logger.warning("LLM 生成仓库介绍失败 %s: %s", name, e)
        intro = None
    website = repo.get("website")
    if not website and desc:
        raw = _extract_url_from_description(desc)
        if raw and raw.startswith("http"):
            website = raw
        elif raw and "." in raw and " " not in raw:
            website = "https://" + raw
    tags = repo.get("tags") if isinstance(repo.get("tags"), list) else []
    return {**repo, "intro": intro, "website": website, "tags": tags or []}


async def run_crawl_and_save(trend_date: date) -> bool:
    """
    执行一次爬取 + LLM 丰富 + 写入 github_trending / github_trending_llm。
    使用数据库中的配置（Github 热门仓库是否开启、LLM、项目总结提示词）。
    返回是否执行成功（未开启或配置缺失时也会返回 True，表示无需重试）。
    """
    async with AsyncSessionLocal() as db:
        gt_config = await get_github_trending_config(db)
        if not gt_config.get("github_trending_enabled"):
            logger.info("Github 热门仓库爬取未开启，跳过")
            return True
        llm_config = await get_llm_config(db)
        project_prompt = gt_config.get("github_trending_project_summary_prompt", "")

    loop = asyncio.get_event_loop()
    try:
        repos = await loop.run_in_executor(None, fetch_trending_sync)
    except Exception as e:
        logger.exception("爬取 GitHub Trending 失败: %s", e)
        return False
    if not repos:
        logger.warning("未爬取到任何仓库")
        return True

    for i, r in enumerate(repos):
        try:
            about = await loop.run_in_executor(None, fetch_repo_about_sync, r["full_name"])
            if about.get("website"):
                r["website"] = about["website"]
            if about.get("tags"):
                r["tags"] = about["tags"]
        except Exception as e:
            logger.warning("爬取仓库 About 失败 %s: %s", r.get("full_name"), e)
        if (i + 1) % 5 == 0:
            logger.info("已爬取仓库 About %s/%s", i + 1, len(repos))

    if llm_config.get("llm_api_key"):
        enriched = []
        for i, r in enumerate(repos):
            r = await loop.run_in_executor(
                None,
                enrich_repo_with_llm_sync,
                r,
                llm_config,
                project_prompt,
            )
            enriched.append(r)
            if (i + 1) % 5 == 0:
                logger.info("已 LLM 丰富 %s/%s", i + 1, len(repos))
        repos = enriched

    async with AsyncSessionLocal() as db:
        stmt = pg_insert(GitHubTrending).values([
            {
                "trend_date": trend_date,
                "full_name": r["full_name"],
                "description": r.get("description"),
                "language": r.get("language"),
                "stars": r.get("stars"),
                "forks": r.get("forks"),
                "stars_today": r.get("stars_today"),
            }
            for r in repos
        ])
        stmt = stmt.on_conflict_do_update(
            index_elements=["trend_date", "full_name"],
            set_={
                GitHubTrending.description: stmt.excluded.description,
                GitHubTrending.language: stmt.excluded.language,
                GitHubTrending.stars: stmt.excluded.stars,
                GitHubTrending.forks: stmt.excluded.forks,
                GitHubTrending.stars_today: stmt.excluded.stars_today,
            },
        )
        await db.execute(stmt)
        await db.commit()

    async with AsyncSessionLocal() as db:
        llm_rows = [
            {
                "trend_date": trend_date,
                "full_name": r["full_name"],
                "intro": r.get("intro"),
                "website": r.get("website") or None,
                "tags": r.get("tags") if isinstance(r.get("tags"), list) else [],
            }
            for r in repos
            if "intro" in r or "website" in r or r.get("tags")
        ]
        if llm_rows:
            stmt = pg_insert(GitHubTrendingLlm).values(llm_rows)
            stmt = stmt.on_conflict_do_update(
                index_elements=["trend_date", "full_name"],
                set_={
                    GitHubTrendingLlm.intro: stmt.excluded.intro,
                    GitHubTrendingLlm.website: stmt.excluded.website,
                    GitHubTrendingLlm.tags: stmt.excluded.tags,
                    GitHubTrendingLlm.updated_at: datetime.utcnow(),
                },
            )
            await db.execute(stmt)
            await db.commit()

    logger.info("Github trending 数据已写入，日期 %s，共 %s 条", trend_date, len(repos))
    return True


def _generate_daily_article_sync(
    daily_prompt: str,
    trending_text: str,
    llm_config: Dict[str, str],
) -> Optional[str]:
    """同步调用 LLM 生成每日热点文章正文（Markdown）。"""
    api_key = (llm_config or {}).get("llm_api_key")
    if not api_key:
        return None
    base_url = llm_config.get("llm_base_url") or "https://api.openai.com/v1"
    model = llm_config.get("llm_model") or "gpt-4o-mini"
    client = OpenAI(api_key=api_key, base_url=base_url)
    prompt = (daily_prompt.strip() or "请根据以下今日 GitHub 热门仓库数据，生成一篇完整的博客文章（Markdown），介绍今日热点项目。") + "\n\n" + trending_text
    try:
        resp = client.chat.completions.create(
            model=model,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.5,
        )
        return (resp.choices[0].message.content or "").strip()
    except Exception as e:
        logger.exception("LLM 生成每日热点文章失败: %s", e)
        return None


async def run_daily_summary_and_post(trend_date: date) -> bool:
    """
    根据当日 github_trending + github_trending_llm 数据，用每日总结提示词生成一篇博客文章，
    状态使用配置的默认状态；若为发布则发邮件通知。
    """
    async with AsyncSessionLocal() as db:
        gt_config = await get_github_trending_config(db)
        if not gt_config.get("github_trending_enabled"):
            return True
        daily_prompt = gt_config.get("github_trending_daily_summary_prompt", "")
        default_status = gt_config.get("github_trending_daily_summary_default_status", "DRAFT")
        if default_status not in (PostStatus.DRAFT.value, PostStatus.PUBLISHED.value):
            default_status = PostStatus.DRAFT.value

        # 查询当日 trending + llm
        r_t = await db.execute(
            select(GitHubTrending).where(GitHubTrending.trend_date == trend_date)
        )
        rows_t = r_t.scalars().all()
        r_l = await db.execute(
            select(GitHubTrendingLlm).where(GitHubTrendingLlm.trend_date == trend_date)
        )
        rows_l = r_l.scalars().all()
    if not rows_t:
        logger.warning("当日无 trending 数据，跳过生成每日热点文章")
        return True

    llm_map = {r.full_name: r for r in rows_l}
    lines = []
    for t in rows_t:
        intro = ""
        website = ""
        tags_str = ""
        if t.full_name in llm_map:
            L = llm_map[t.full_name]
            intro = L.intro or ""
            website = L.website or ""
            tags_str = ", ".join(L.tags) if L.tags else ""
        lines.append(
            f"- **{t.full_name}**\n"
            f"  描述: {t.description or ''}\n"
            f"  语言: {t.language or ''}\n"
            f"  Stars: {t.stars or 0}, Forks: {t.forks or 0}, 今日星: {t.stars_today or 0}\n"
            f"  介绍: {intro}\n"
            f"  官网: {website}\n"
            f"  标签: {tags_str}\n"
        )
    trending_text = "\n".join(lines)

    async with AsyncSessionLocal() as db:
        llm_config = await get_llm_config(db)
    loop = asyncio.get_event_loop()
    content = await loop.run_in_executor(
        None,
        _generate_daily_article_sync,
        daily_prompt,
        trending_text,
        llm_config,
    )
    if not content:
        logger.warning("每日热点文章内容生成为空")
        return True

    title = f"GitHub 每日热门仓库 · {trend_date.isoformat()}"
    slug_base = f"github-trending-{trend_date.isoformat()}"
    slug = slug_base
    async with AsyncSessionLocal() as db:
        # 取第一个管理员作为作者
        r = await db.execute(select(User).where(User.role == UserRole.ADMIN).limit(1))
        author = r.scalar_one_or_none()
        if not author:
            logger.error("无管理员用户，无法创建每日热点文章")
            return False
        idx = 0
        while True:
            r = await db.execute(select(Post).where(Post.slug == slug))
            if r.scalar_one_or_none() is None:
                break
            idx += 1
            slug = f"{slug_base}-{idx}"
        post = Post(
            title=title,
            slug=slug,
            content=content,
            excerpt=(content[:200] + "…") if len(content) > 200 else content,
            status=default_status,
            author_id=author.id,
            published_at=datetime.utcnow() if default_status == PostStatus.PUBLISHED.value else None,
        )
        db.add(post)
        await db.commit()
        await db.refresh(post)
        new_post = post

    logger.info("每日热点文章已创建: %s, status=%s", new_post.slug, default_status)

    if default_status == PostStatus.PUBLISHED.value:
        async with AsyncSessionLocal() as db:
            email_config = await get_email_config(db)
            site_basic = await get_site_basic_config(db)
        site_url = (site_basic.get("site_url") or "").strip().rstrip("/")
        site_title = site_basic.get("site_title") or "博客"
        post_url = f"{site_url}/posts/{new_post.slug}" if site_url else ""
        if post_url:
            async with AsyncSessionLocal() as db:
                r = await db.execute(select(User.email).where(User.is_active == True))
                to_emails = [row[0] for row in r.all()]
            for to_email in to_emails:
                if to_email:
                    await email_service.send_new_post_notification(
                        to_email, new_post.title, new_post.excerpt, post_url, site_title, smtp_config=email_config
                    )
            logger.info("已发送新文章通知邮件")
    return True


GITHUB_TRENDING_LAST_RUN_DATE_KEY = "github_trending_last_run_date"


async def github_trending_scheduler_loop() -> None:
    """
    每日 9 点执行：若开启则爬取 trending、写入数据、生成每日热点文章。
    """
    logger.info("Github 热门仓库定时任务启动")
    try:
        while True:
            try:
                now = datetime.utcnow()
                # 每天 9 点（按 UTC，可改为本地时区）
                run_hour = 9
                if now.hour == run_hour:
                    async with AsyncSessionLocal() as db:
                        gt_config = await get_github_trending_config(db)
                        if not gt_config.get("github_trending_enabled"):
                            await asyncio.sleep(3600)
                            continue
                        result = await db.execute(
                            select(Config).where(Config.key == GITHUB_TRENDING_LAST_RUN_DATE_KEY)
                        )
                        cfg = result.scalar_one_or_none()
                        last_date_str = cfg.value if cfg and cfg.value else None
                    today = date.today()
                    if last_date_str != today.isoformat():
                        logger.info("执行 Github 热门仓库每日任务，日期 %s", today)
                        await run_crawl_and_save(today)
                        await run_daily_summary_and_post(today)
                        async with AsyncSessionLocal() as db:
                            result = await db.execute(
                                select(Config).where(Config.key == GITHUB_TRENDING_LAST_RUN_DATE_KEY)
                            )
                            c = result.scalar_one_or_none()
                            if c:
                                c.value = today.isoformat()
                            else:
                                db.add(Config(key=GITHUB_TRENDING_LAST_RUN_DATE_KEY, value=today.isoformat()))
                            await db.commit()
                await asyncio.sleep(3600)
            except asyncio.CancelledError:
                raise
            except Exception as e:
                logger.exception("Github 热门仓库定时任务异常: %s", e)
                await asyncio.sleep(600)
    except asyncio.CancelledError:
        logger.info("Github 热门仓库定时任务已取消")
