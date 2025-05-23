import React from "react";
import "../../styles/main/OurServices.css";
import img1 from "/assets/main/printkee-img.png";
import img2 from "/assets/main/coachingpromo-img.png";
import img3 from "/assets/main/other-img.png";

const services = [
  {
    image: img1,
    tag: "DESIGN",
    title: "Corporate Gift Curation",
    description: "Premium, Memorable, Tailored, Impactful",
    url: "https://printkee.com",
  },
  {
    image: img2,
    tag: "BRANDING",
    title: "Custom Logo Printing",
    description: "Sharp, Bold, Consistent, Unique",
    url: "https://coachingpromo.in",
  },
  {
    image: img3,
    tag: "DELIVERY",
    title: "Pan-India Fulfilment",
    description: "Fast, Reliable, Nationwide, Efficient",
    url: "https://printkee.com",
  },
];

const OurServices = () => {
  return (
    <section className="services-section">
      <h2 className="services-heading">Our Services</h2>
      <p className="services-quote">Innovative Solutions, Tailored Excellence</p>
      <div className="services-grid">
        {services.map((service, index) => (
          <div className="service-card" key={index}>
            <img src={service.image} alt={service.title} className="service-image" />
            <div className="service-content">
              <p className="service-tag">{service.tag}</p>
              <h3 className="service-title">{service.title}</h3>
              <p className="service-description">{service.description}</p>
              <button className="explore-button" onClick={() => window.open(service.url, "_blank")}>
                Explore <span className="arrow">→</span>
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};

export default OurServices;
