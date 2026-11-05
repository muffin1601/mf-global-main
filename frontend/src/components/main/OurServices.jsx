import React from "react";
import "../../styles/main/OurServices.css";

import premiumGiftsImage from "/assets/main/other-img.webp";
import img2 from "/assets/main/coachingpromo-img.webp";

const services = [
  {
    image: premiumGiftsImage,
    tag: "PREMIUM GIFTS",
    title: "Premium Gifts",
    description:
      "Thoughtfully curated premium gifts designed to strengthen relationships with clients, partners, and employees. From onboarding kits to festive hampers, we deliver memorable brand experiences.",
    url: "https://giftaguru.com/",
  },
  {
    image: img2,
    tag: "PRINT & PROMO",
    title: "Edu Print & Promo",
    description:
      "High-quality educational printing and promotional materials for institutes, coaching centers, and brands. Designed to communicate clearly, consistently, and professionally across channels.",
    url: "https://coachingpromo.in",
  },
];

const OurServices = () => {
  return (
    <section className="services-section" id="services" aria-labelledby="services-title">
      <h2 className="services-heading" id="services-title">
        Empowering Brands Through Curated Corporate Gifting Solutions
      </h2>

      <p className="services-quote">
        From welcome kits to festive hampers, our end-to-end services are designed
        to elevate employee experiences, impress clients, and make your brand
        unforgettable.
      </p>

      <div className="services-grid">
        {services.map((service) => (
          <div className="service-card" key={service.title}>
            <img
              src={service.image}
              alt={service.title}
              className="service-image"
              loading="lazy"
              decoding="async"
            />

            <div className="service-content">
              <p className="service-tag">{service.tag}</p>
              <h3 className="service-title">{service.title}</h3>
              <p className="service-description">{service.description}</p>

              {service.url && (
                <a
                  className="explore-button"
                  href={service.url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Explore <span className="arrow">→</span>
                </a>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};

export default OurServices;
