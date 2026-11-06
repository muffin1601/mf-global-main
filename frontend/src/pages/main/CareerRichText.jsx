import React, { useRef } from 'react';
import './CareerRichText.css';

export function RichTextDisplay({ value }) {
  const lines = String(value || '').split(/\r?\n/);
  const inline = text => text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g).map((piece, index) => piece.startsWith('**') && piece.endsWith('**') ? <strong key={index}>{piece.slice(2,-2)}</strong> : piece.startsWith('*') && piece.endsWith('*') ? <em key={index}>{piece.slice(1,-1)}</em> : piece);
  return <div className="career-rich-display">{lines.map((line,index) => line.startsWith('- ') ? <p className="career-rich-bullet" key={index}>• {inline(line.slice(2))}</p> : <p key={index}>{inline(line)}</p>)}</div>;
}

export function RichTextEditor({ value, onChange, required }) {
  const ref = useRef(null);
  const insert = (before, after = '') => {
    const input = ref.current; if (!input) return;
    const start = input.selectionStart, end = input.selectionEnd;
    const selection = value.slice(start,end) || 'text';
    onChange(value.slice(0,start) + before + selection + after + value.slice(end));
    requestAnimationFrame(() => input.focus());
  };
  return <div className="career-rich-editor"><div className="career-rich-toolbar" aria-label="Formatting controls"><button type="button" onClick={() => insert('**','**')} aria-label="Bold"><strong>B</strong></button><button type="button" onClick={() => insert('*','*')} aria-label="Italic"><em>I</em></button><button type="button" onClick={() => insert('- ')} aria-label="Bulleted list">• List</button></div><textarea ref={ref} required={required} value={value || ''} onChange={e => onChange(e.target.value)} /><details><summary>Preview formatted text</summary><RichTextDisplay value={value} /></details></div>;
}
