import React from "react";
import "../../styles/main/OurServices.css";

import img1 from "/assets/main/printkee-img.webp";
import img2 from "/assets/main/coachingpromo-img.webp";
import img3 from "/assets/main/5 (1).png";
import img4 from "/assets/main/5 (2).png";

const services = [
  {
    image: img1,
    tag: "GIFTING",
    title: "Corporate Gifting",
    description:
      "Thoughtfully curated corporate gifts designed to strengthen relationships with clients, partners, and employees. From onboarding kits to festive hampers, we deliver memorable brand experiences.",
    url: "https://printkee.com",
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
    image: img3,
    tag: "CREATIVE",
    title: "Creative Team",
    description:
      "Our in-house creative team brings ideas to life through compelling visuals, layouts, and concepts. We focus on clarity, originality, and brand alignment across every deliverable.",
    url: null,
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
    <section className="services-section">
      <h2 className="services-heading">
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
            />

            <div className="service-content">
              <p className="service-tag">{service.tag}</p>
              <h3 className="service-title">{service.title}</h3>
              <p className="service-description">{service.description}</p>

              {service.url && (
                <button
                  className="explore-button"
                  onClick={() => window.open(service.url, "_blank")}
                >
                  Explore <span className="arrow">→</span>
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};

export default OurServices;
