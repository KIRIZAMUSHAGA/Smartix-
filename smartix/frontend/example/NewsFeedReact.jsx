/* Exemple React (web / React Native Web compatible) */
import React, { useEffect, useState } from "react";
import PropTypes from 'prop-types';

export default function NewsFeed() {
  const [news, setNews] = useState([]);
  const [page, setPage] = useState(1);

  async function load() {
    const res = await fetch(`/api/news?limit=20&page=${page}`);
    const data = await res.json();
    setNews(prev => [...prev, ...data]);
  }

  useEffect(() => {
    load();
  }, [page]);

  return (
    <div style={{padding: 12}}>
      {news.map(n => (
        <div key={n.id} style={{display: "flex", gap:12, marginBottom: 16, borderBottom:"1px solid #eee", paddingBottom: 8}}>
          <img src={n.image_url} style={{width:120, height:80, objectFit:"cover"}} alt="" onError={(e)=>e.target.style.display='none'} />
          <div style={{flex:1}}>
            <div style={{fontWeight:700}}>{n.title}</div>
            <div style={{color:"#666", fontSize:13}}>{n.summary}</div>
            <div style={{marginTop:6, fontSize:12, color:"#999"}}>{n.source || ""} • {new Date(n.published_at).toLocaleString()}</div>
          </div>
        </div>
      ))}
      <button onClick={()=>setPage(p=>p+1)}>Charger plus</button>
    </div>
  );
}
NewsFeed.propTypes = {};
