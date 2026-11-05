import React from 'react';
import { Link } from "react-router-dom";
import '../../styles/main/HeroSection.css';

const HeroSection = () => {
  return (
    <section className="hero">
        <div className="hero-overlay"></div>
        <div className="hero-text">
          <h1 className="hero-title">Premium Corporate Gifting Solutions That Impress & Inspire!</h1>
          <p className="hero-subtitle">Custom-branded gifts, employee welcome kits, festive hampers & more — designed to build stronger business relationships.</p>
          <Link className="hero-cta" to="/contact">Talk to our team <span aria-hidden="true">→</span></Link>
        </div>
    </section>
  );
};

export default HeroSection;
