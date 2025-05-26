import { useEffect, useState } from "react";

export function usePfpUrls() {
  const [imageUrls, setImageUrls] = useState([])
  useEffect(() => {

    const images = import.meta.glob('../assets/pfp*.png', {
      eager: true,
      query: '?url',
      import: 'default'
    });
    const urls = Object.values(images)

    setImageUrls(urls)

  }, [])
  return imageUrls
}
