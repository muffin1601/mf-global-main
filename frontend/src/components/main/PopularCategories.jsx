import React from "react";
import "../../styles/main/PopularCategories.css";
import { FaGift, FaLeaf, FaBriefcase, FaHatCowboy, FaHandsHelping, FaRegLaughWink } from "react-icons/fa";
import { Link } from "react-router-dom";

const categories = [
  {
    icon: <FaHandsHelping />,
    title: "Employee Welcome Kits",
    desc: "Curated onboarding boxes to welcome new hires with branded essentials.",
  },
  {
    icon: <FaRegLaughWink />,
    title: "Festive Gift Hampers",
    desc: "Celebrate every festival with customized, delightful gift packs.",
  },
  {
    icon: <FaGift />,
    title: "Event Giveaways",
    desc: "Perfect takeaways for seminars, conferences, and corporate events.",
  },
  {
    icon: <FaHatCowboy />,
    title: "Branded Merchandise",
    desc: "Caps, mugs, T-shirts & more with your company logo & colors.",
  },
  {
    icon: <FaBriefcase />,
    title: "Executive Gifts",
    desc: "Premium selections for top-level executives and partners.",
  },
  {
    icon: <FaLeaf />,
    title: "Eco-Friendly Gifts",
    desc: "Sustainable and responsible gifting made stylish.",
  },
];

const PopularCategories = () => (
  <section className="categories-section" id="products" aria-labelledby="categories-title">
    <div className="categories-content">
      <h2 className="section-title" id="categories-title">Discover Our Best-Selling Gifting Collections</h2>
      <div className="categories-grid">
        {categories.map((item, idx) => (
          <div className="category-card" key={idx}>
            <div className="category-icon">{item.icon}</div>
            <div className="category-title">{item.title}</div>
            <div className="category-desc">{item.desc}</div>
          </div>
        ))}
      </div>
      <Link className="catalog-btn" to="/contact">Explore gifting options <span aria-hidden="true">→</span></Link>
    </div>
  </section>
);

export default PopularCategories;
