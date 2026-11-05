import { useEffect } from "react";

const setMeta = (selector, attribute, value) => {
  let element = document.head.querySelector(selector);
  const created = !element;
  if (!element) {
    element = document.createElement("meta");
    const [key, name] = attribute;
    element.setAttribute(key, name);
    document.head.appendChild(element);
  }
  const previous = element.getAttribute("content");
  element.setAttribute("content", value);
  return () => {
    if (created) element.remove();
    else if (previous === null) element.removeAttribute("content");
    else element.setAttribute("content", previous);
  };
};

const useMarketingMeta = (title, description, image = "/assets/logo.webp") => {
  useEffect(() => {
    const previousTitle = document.title;
    document.title = title;
    const cleanups = [
      setMeta('meta[name="description"]', ["name", "description"], description),
      setMeta('meta[property="og:title"]', ["property", "og:title"], title),
      setMeta('meta[property="og:description"]', ["property", "og:description"], description),
      setMeta('meta[property="og:type"]', ["property", "og:type"], "website"),
      setMeta('meta[property="og:url"]', ["property", "og:url"], window.location.href),
      setMeta('meta[property="og:image"]', ["property", "og:image"], new URL(image, window.location.origin).href),
    ];
    return () => {
      cleanups.forEach((cleanup) => cleanup());
      document.title = previousTitle;
    };
  }, [description, image, title]);
};

export default useMarketingMeta;
