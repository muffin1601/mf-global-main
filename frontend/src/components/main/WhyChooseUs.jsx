import React from "react";
import { ShieldCheck, Truck, Gift, ThumbsUp, Users } from "lucide-react";
import "../../styles/main/WhyChooseUs.css";

const features = [
  {
    icon: <ShieldCheck size={28} />,
    title: "Trusted by 1000+ Brands",
    description: "Our long-standing partnerships with top corporate names reflect our reliability.",
  },
  {
    icon: <Truck size={28} />,
    title: "PAN India & Global Delivery",
    description: "We ship premium gifts across India and abroad with guaranteed timelines.",
  },
  {
    icon: <Gift size={28} />,
    title: "Customized Gifting Solutions",
    description: "From packaging to products – everything reflects your brand identity.",
  },
  {
    icon: <ThumbsUp size={28} />,
    title: "On-Time Delivery, Every Time",
    description: "We value your deadlines – no delays, only professional execution.",
  },
  {
    icon: <Users size={28} />,
    title: "Dedicated Support Team",
    description: "Our expert team ensures seamless execution from start to finish.",
  },
];

const WhyChooseUs = () => {
  return (
    <section className="why-wrapper">
      <div className="why-content">
        <h2 className="why-heading">Why Leading Brands Trust MF Global Services</h2>
        <p className="why-subheading">
          Our commitment to quality, delivery, and customization makes us a trusted corporate gifting partner.
        </p>
        <div className="why-grid">
          {features.map((item, idx) => (
            <div key={idx} className="why-card">
              <div className="why-icon">{item.icon}</div>
              <h4 className="why-title">{item.title}</h4>
              <p className="why-description">{item.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default WhyChooseUs;
