import React, { useEffect, useState } from "react";
import PropTypes from 'prop-types';

export default function NewsDetail({newsId}) {
  const [item, setItem] = useState(null);
  
  useEffect(()=> {
    fetch(`/api/news/${newsId}`).then(r=>r.json()).then(setItem);
  },[newsId]);
  
  if(!item) return <div>Chargement…</div>;
  
  return (
    <div style={{padding:16}}>
      <h1>{item.title}</h1>
      {item.image_url && <img src={item.image_url} style={{maxWidth:"100%"}} alt=""/>}
      <p>{item.summary}</p>
      <a href={item.url} target="_blank">Lire l'article original</a>
    </div>
  );
}
NewsDetail.propTypes = {
  newsId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
};
