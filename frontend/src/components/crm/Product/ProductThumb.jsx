import React, { useState, useEffect } from "react";
import { PRODUCT_IMAGE_PLACEHOLDER, resolveProductImageUrl } from "../../../utils/productImage";

/**
 * Compact product thumbnail used on quotation item rows.
 * A missing, deleted or broken image silently degrades to the inline
 * placeholder — it can never break the quotation.
 */
const ProductThumb = ({ src, alt = "", className = "" }) => {
    const resolved = resolveProductImageUrl(src);
    const [failed, setFailed] = useState(false);

    // Reset the error state when the item's image changes (e.g. row re-order).
    useEffect(() => setFailed(false), [resolved]);

    return (
        <img
            src={!resolved || failed ? PRODUCT_IMAGE_PLACEHOLDER : resolved}
            alt={alt}
            title={alt}
            loading="lazy"
            decoding="async"
            onError={() => setFailed(true)}
            className={`qtn-product-thumb ${className}`.trim()}
        />
    );
};

export default ProductThumb;
