from fastapi import APIRouter, Query, HTTPException, Depends
from db import get_db
from datetime import date, datetime, timedelta, timezone
from math import ceil
from middleware.auth_middleware import get_current_user

router = APIRouter(tags=["Community"])


def serialize(doc: dict) -> dict:
    if "_id" in doc:
        doc["_id"] = str(doc["_id"])
    return doc


@router.get("/community/{content_type}")
async def get_community_content(
    content_type: str,
    page: int = Query(1, ge=1),
    limit: int = Query(10, ge=1, le=50),
):
    db = get_db()
    skip = (page - 1) * limit

    try:
        if content_type == "posts":
            posts = await db.posts.find({
                "$and": [
                    {"deleted": {"$ne": True}},
                    {"status": {"$ne": "trashed"}}
                ]
            }).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)

            user_ids = list({p.get("user_id") for p in posts if p.get("user_id")})
            users = await db.users.find({"id": {"$in": user_ids}}).to_list(len(user_ids) or 1)
            users_dict = {u["id"]: u for u in users}

            items = []
            for p in posts:
                p = serialize(p)
                user_info = users_dict.get(p.get("user_id"), {})
                p["author"] = {
                    "id": user_info.get("id", p.get("user_id")),
                    "full_name": user_info.get("full_name", "Utilisateur"),
                    "avatar": user_info.get("avatar"),
                }
                if not p.get("id"):
                    p["id"] = p.get("_id", str(skip + len(items)))
                items.append(p)

            return {"items": items}

        elif content_type == "groups":
            groups = (
                await db.groups.find({"visibility": "public"})
                .sort("created_at", -1)
                .skip(skip)
                .limit(limit)
                .to_list(limit)
            )
            if not groups:
                groups = await db.groups.find().sort("created_at", -1).skip(skip).limit(limit).to_list(limit)

            items = []
            for g in groups:
                g = serialize(g)
                if not g.get("id"):
                    g["id"] = g.get("_id", str(skip + len(items)))
                g["members_count"] = len(g.get("members", []))
                g.setdefault("category", "Général")
                g.setdefault("icon", "📚")
                items.append(g)

            return {"items": items}

        elif content_type == "ranking":
            users = (
                await db.users.find({"points": {"$exists": True}})
                .sort("points", -1)
                .skip(skip)
                .limit(limit)
                .to_list(limit)
            )
            if not users:
                users = await db.users.find().sort("created_at", 1).skip(skip).limit(limit).to_list(limit)

            items = []
            for i, u in enumerate(users):
                u = serialize(u)
                if not u.get("id"):
                    u["id"] = u.get("_id", str(i))
                items.append({
                    "id": u.get("id"),
                    "full_name": u.get("full_name", "Utilisateur"),
                    "avatar": u.get("avatar"),
                    "points": u.get("points", 0),
                    "badge": u.get("badge", "Apprenant"),
                    "rank": skip + i + 1,
                })

            return {"items": items}

        elif content_type == "projects":
            projects = (
                await db.projects.find({"status": {"$ne": "archived"}})
                .sort("created_at", -1)
                .skip(skip)
                .limit(limit)
                .to_list(limit)
            )

            items = []
            for p in projects:
                p = serialize(p)
                if not p.get("id"):
                    p["id"] = p.get("_id", str(skip + len(items)))
                p.setdefault("status", "En cours")
                p.setdefault("progress", 0)
                p.setdefault("lead", "Équipe Smartix")
                items.append(p)

            return {"items": items}

        else:
            return {"items": []}

    except Exception as e:
        print(f"❌ Community fetch error ({content_type}): {e}")
        return {"items": []}


# =============================
# B1+B2 — SYSTÈME CYCLIQUE QUOTIDIEN
# =============================
@router.get("/community/posts/cycle")
async def get_community_posts_cycle():
    db = get_db()
    lot_size = 5
    try:
        status_filter = {"$or": [{"status": "published"}, {"status": {"$exists": False}}]}
        total_posts = await db.posts.count_documents(status_filter)
        if total_posts == 0:
            return {"items": [], "lot_index": 0, "total_lots": 0}

        total_lots = max(1, ceil(total_posts / lot_size))
        day_index = date.today().toordinal()
        lot_index = day_index % total_lots
        skip = lot_index * lot_size

        posts = (
            await db.posts.find(status_filter)
            .sort("created_at", -1)
            .skip(skip)
            .limit(lot_size)
            .to_list(lot_size)
        )

        user_ids = list({p.get("user_id") for p in posts if p.get("user_id")})
        users = await db.users.find({"id": {"$in": user_ids}}).to_list(len(user_ids) or 1)
        users_dict = {u["id"]: u for u in users}

        items = []
        for p in posts:
            p = serialize(p)
            user_info = users_dict.get(p.get("user_id"), {})
            avatar_val = user_info.get("avatar")
            p["author"] = {
                "id": user_info.get("id", p.get("user_id")),
                "full_name": user_info.get("full_name", "Utilisateur"),
                "avatar": avatar_val,
                "profile_picture": avatar_val,
            }
            if not p.get("id"):
                p["id"] = p.get("_id", str(skip + len(items)))
            p["likes_count"] = len(p.get("likes", []))
            items.append(p)

        return {"items": items, "lot_index": lot_index, "total_lots": total_lots}

    except Exception as e:
        print(f"❌ Cycle fetch error: {e}")
        return {"items": [], "lot_index": 0, "total_lots": 0}


# =============================
# B2b — SYSTÈME CYCLIQUE QUOTIDIEN — GROUPES
# =============================
@router.get("/community/groups/cycle")
async def get_community_groups_cycle():
    db = get_db()
    lot_size = 5
    try:
        total_groups = await db.groups.count_documents({"visibility": "public"})
        if total_groups == 0:
            total_groups = await db.groups.count_documents({})
        if total_groups == 0:
            return {"items": [], "lot_index": 0, "total_lots": 0}

        total_lots = max(1, ceil(total_groups / lot_size))
        day_index = date.today().toordinal()
        lot_index = day_index % total_lots
        skip = lot_index * lot_size

        groups = (
            await db.groups.find({"visibility": "public"})
            .sort("created_at", -1)
            .skip(skip)
            .limit(lot_size)
            .to_list(lot_size)
        )
        if not groups:
            groups = (
                await db.groups.find()
                .sort("created_at", -1)
                .skip(skip)
                .limit(lot_size)
                .to_list(lot_size)
            )

        items = []
        for g in groups:
            g = serialize(g)
            if not g.get("id"):
                g["id"] = g.get("_id", str(skip + len(items)))
            g["members_count"] = len(g.get("members", []))
            g.setdefault("category", "Général")
            g.setdefault("icon", "📚")
            items.append(g)

        return {"items": items, "lot_index": lot_index, "total_lots": total_lots}

    except Exception as e:
        print(f"❌ Groups cycle fetch error: {e}")
        return {"items": [], "lot_index": 0, "total_lots": 0}


# =============================
# B2d — CLASSEMENT HEBDOMADAIRE
# =============================
@router.get("/community/ranking/cycle")
async def get_community_ranking_weekly():
    db = get_db()
    try:
        # Début de la semaine en cours (lundi 00:00 UTC)
        today = date.today()
        monday = today - timedelta(days=today.weekday())
        week_start = datetime(monday.year, monday.month, monday.day, tzinfo=timezone.utc)

        # 1. Posts publiés cette semaine + likes reçus sur ces posts
        posts_pipeline = [
            {"$match": {"created_at": {"$gte": week_start}}},
            {"$group": {
                "_id": "$user_id",
                "posts_count": {"$sum": 1},
                "likes_count": {"$sum": {"$size": {"$ifNull": ["$likes", []]}}}
            }}
        ]
        posts_agg = await db.posts.aggregate(posts_pipeline).to_list(None)
        posts_by_user = {r["_id"]: r for r in posts_agg if r["_id"]}

        # 2. Projets publiés (total, pas hebdo — c'est un effort long terme)
        projects_pipeline = [
            {"$match": {"status": "published"}},
            {"$group": {"_id": "$userId", "projects_count": {"$sum": 1}}}
        ]
        projects_agg = await db.projects.aggregate(projects_pipeline).to_list(None)
        projects_by_user = {r["_id"]: r["projects_count"] for r in projects_agg if r["_id"]}

        # 3. Abonnés (amis acceptés reçus = to_user_id)
        friends_pipeline = [
            {"$match": {"status": "accepted"}},
            {"$group": {"_id": "$to_user_id", "followers_count": {"$sum": 1}}}
        ]
        friends_agg = await db.friend_requests.aggregate(friends_pipeline).to_list(None)
        followers_by_user = {r["_id"]: r["followers_count"] for r in friends_agg if r["_id"]}

        # 4. Récupérer tous les utilisateurs concernés
        all_user_ids = (
            set(posts_by_user.keys()) |
            set(projects_by_user.keys()) |
            set(followers_by_user.keys())
        )

        if all_user_ids:
            users = await db.users.find({"id": {"$in": list(all_user_ids)}}).to_list(len(all_user_ids))
        else:
            # Fallback : utilisateurs avec le plus de points
            users = await db.users.find({"points": {"$exists": True}}).sort("points", -1).limit(20).to_list(20)

        # 5. Calcul du score pondéré
        WEIGHTS = {"posts": 10, "followers": 5, "projects": 20, "likes": 2}
        scored = []
        for u in users:
            uid = u.get("id")
            if not uid:
                continue
            post_data = posts_by_user.get(uid, {})
            posts_c = post_data.get("posts_count", 0)
            likes_c = post_data.get("likes_count", 0)
            projects_c = projects_by_user.get(uid, 0)
            followers_c = followers_by_user.get(uid, 0)
            score = (
                posts_c * WEIGHTS["posts"] +
                followers_c * WEIGHTS["followers"] +
                projects_c * WEIGHTS["projects"] +
                likes_c * WEIGHTS["likes"]
            )
            scored.append({
                "id": uid,
                "full_name": u.get("full_name", "Utilisateur"),
                "avatar": u.get("avatar"),
                "badge": u.get("badge", "Apprenant"),
                "score": score,
                "points": score,
                "stats": {
                    "posts": posts_c,
                    "followers": followers_c,
                    "projects": projects_c,
                    "likes": likes_c,
                }
            })

        # Trier et attribuer les rangs
        scored.sort(key=lambda x: x["score"], reverse=True)
        items = []
        for i, u in enumerate(scored[:20]):
            u["rank"] = i + 1
            items.append(u)

        return {"items": items, "week_start": week_start.isoformat()}

    except Exception as e:
        print(f"❌ Weekly ranking error: {e}")
        return {"items": [], "week_start": None}


# =============================
# B2c — SYSTÈME CYCLIQUE QUOTIDIEN — PROJETS (VIBE-CODING)
# =============================
@router.get("/community/projects/cycle")
async def get_community_projects_cycle():
    db = get_db()
    lot_size = 5
    try:
        query = {"status": {"$ne": "archived"}}
        total_projects = await db.projects.count_documents(query)
        if total_projects == 0:
            return {"items": [], "lot_index": 0, "total_lots": 0}

        total_lots = max(1, ceil(total_projects / lot_size))
        day_index = date.today().toordinal()
        lot_index = day_index % total_lots
        skip = lot_index * lot_size

        projects = (
            await db.projects.find(query)
            .sort("updatedAt", -1)
            .skip(skip)
            .limit(lot_size)
            .to_list(lot_size)
        )

        # Récupérer les auteurs
        user_ids = list({p.get("userId") for p in projects if p.get("userId")})
        users = await db.users.find({"id": {"$in": user_ids}}).to_list(len(user_ids) or 1)
        users_dict = {u["id"]: u for u in users}

        items = []
        for p in projects:
            p = serialize(p)
            if not p.get("id"):
                p["id"] = p.get("_id", str(skip + len(items)))
            user_info = users_dict.get(p.get("userId"), {})
            # Normaliser les champs pour le frontend
            p["title"] = p.get("name") or p.get("title") or "Projet sans titre"
            p["lead"] = user_info.get("full_name") or p.get("lead") or "Équipe Smartix"
            p["progress"] = p.get("progress") or p.get("metadata", {}).get("progress") or 0
            p["author"] = {
                "id": user_info.get("id", p.get("userId")),
                "full_name": user_info.get("full_name", "Utilisateur"),
                "avatar": user_info.get("avatar"),
            }
            items.append(p)

        return {"items": items, "lot_index": lot_index, "total_lots": total_lots}

    except Exception as e:
        print(f"❌ Projects cycle fetch error: {e}")
        return {"items": [], "lot_index": 0, "total_lots": 0}


# =============================
# B3 — LIKE AVEC ÉMISSION SOCKET.IO
# =============================
@router.post("/community/posts/{post_id}/like")
async def like_community_post(post_id: str, current_user: dict = Depends(get_current_user)):
    db = get_db()
    try:
        user_id = current_user["id"]
        post = await db.posts.find_one({"id": post_id})
        if not post:
            raise HTTPException(status_code=404, detail="Post non trouvé")

        likes = list(post.get("likes", []))
        if user_id in likes:
            likes.remove(user_id)
            liked = False
        else:
            likes.append(user_id)
            liked = True

        await db.posts.update_one({"id": post_id}, {"$set": {"likes": likes}})
        likes_count = len(likes)

        try:
            from utils.socket_manager import sio
            await sio.emit("post:like_update", {
                "post_id": post_id,
                "likes_count": likes_count,
                "liked_by": user_id
            })
        except Exception as socket_err:
            print(f"⚠️ Socket emit error: {socket_err}")

        return {"liked": liked, "likes_count": likes_count}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
