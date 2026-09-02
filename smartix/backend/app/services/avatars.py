"""
Avatar and author name utilities for video sources
"""

SOURCE_AVATARS = {
    "Pexels": "https://images.pexels.com/lib/api/pexels.png",
    "Pixabay": "https://pixabay.com/static/img/public/medium_rectangle_b.png",
    "Mixkit": "https://mixkit.imgix.net/static/mixkit-logo.svg",
    "Coverr": "https://coverr.co/favicon.ico",
    "LifeOfVids": "https://www.lifeofvids.com/favicon.ico",
    "Videvo": "https://www.videvo.net/favicon.ico",
    "Vidsplay": "https://www.vidsplay.com/favicon.ico",
    "Splitshire": "https://www.splitshire.com/favicon.ico",
    "MotionPlaces": "https://motionplaces.com/favicon.ico",
    "Mazwai": "https://mazwai.com/favicon.ico",
    "ArchiveOrg": "https://archive.org/images/glogo.png",
    "Wikimedia": "https://upload.wikimedia.org/wikipedia/commons/thumb/4/4a/Commons-logo.svg/50px-Commons-logo.svg.png",
    "Distill": "https://distillvideo.com/favicon.ico",
    "Clipstill": "https://clipstill.com/favicon.ico",
    "YouTube": "https://www.youtube.com/s/desktop/9e5b1527/img/favicon_32x32.png",
    "Vimeo": "https://f.vimeocdn.com/images_v6/favicon.ico",
    "NASA": "https://www.nasa.gov/favicon.ico",
    "TED": "https://www.ted.com/favicon.ico",
    "Smartix": "/smartix-logo.png",
    "user": "/default-avatar.png",
}

SOURCE_AUTHORS = {
    "Pexels": "Pexels Videos",
    "Pixabay": "Pixabay Community",
    "Mixkit": "Mixkit Free Videos",
    "Coverr": "Coverr Free Footage",
    "LifeOfVids": "Life of Vids",
    "Videvo": "Videvo Stock",
    "Vidsplay": "Vidsplay",
    "Splitshire": "SplitShire",
    "MotionPlaces": "Motion Places",
    "Mazwai": "Mazwai",
    "ArchiveOrg": "Internet Archive",
    "Wikimedia": "Wikimedia Commons",
    "Distill": "Distill Video",
    "Clipstill": "Clipstill",
    "YouTube": "YouTube",
    "Vimeo": "Vimeo",
    "NASA": "NASA",
    "TED": "TED Talks",
    "Smartix": "Smartix",
    "user": "Utilisateur",
}

def avatar_url_for_source(source: str) -> str:
    return SOURCE_AVATARS.get(source, "/default-avatar.png")

def author_name_for_source(source: str) -> str:
    return SOURCE_AUTHORS.get(source, source)
