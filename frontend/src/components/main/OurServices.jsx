import React from "react";
import "../../styles/main/OurServices.css";

import img1 from "/assets/main/printkee-img.webp";
import img2 from "/assets/main/coachingpromo-img.webp";
import img4 from "/assets/main/5 (2).png";

const services = [
  {
    image: img1,
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
  {
    image: img4,
    tag: "DIGITAL",
    title: "Digital Branding",
    description:
      "End-to-end digital branding solutions to build a strong and consistent online presence. From brand identity to digital touchpoints, we help brands connect and grow effectively.",
    url: null,
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
        {services.map((service, index) => (
          <div className="service-card" key={index}>
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
