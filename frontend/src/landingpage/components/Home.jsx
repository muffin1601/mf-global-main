import React from "react";
import "../styles/Home.css";

const Home = () => {
  return (
    <div className="crm-landing">
      <nav className="crm-navbar">
        <div className="crm-logo">🌀 crm</div>
        <ul className="crm-nav-links">
          <li className="active">Home</li>
          <li>About</li>
          <li>More</li>
          <li>Team</li>
          <li>Pricing</li>
          <li>FAQ's</li>
          <li>Testimonials</li>
          <li>Contact Us</li>
          <li onClick={() => (window.location.href = "/crm/entrydashboard")}>CRM Dasboard</li>
        </ul>
        <div className="crm-nav-actions">
          <button className="crm-signup-btn" onClick={() => (window.location.href = "/crm/login")}>Sign In</button>
          <button className="crm-gear-btn">⚙</button>
        </div>
      </nav>

      <header className="crm-hero">
        <div className="crm-hero-text">
          <h4>Powerful. Streamlined. Intelligent.</h4>
          <h1>
            Manage Smarter, Grow Faster:
            <br />
            Discover the <span className="crm-highlight">CRM</span> Built for Performance.
          </h1>
          <p>
            Unlock the full potential of your business with our next-gen CRM platform —
            designed to centralize your data, accelerate workflows, and empower teams with
            real-time insights, all through a sleek, user-first interface.
          </p>
          <div className="crm-hero-buttons">
            <button className="crm-get-started">Get Started Now 🚀</button>
            <button className="crm-schedule-demo">Schedule a Demo 📅</button>
          </div>
        </div>
        <div className="crm-hero-image">
          <img src="/assets/crm/landingpageimg.png" alt="hero" />
        </div>
      </header>

      <section className="crm-why-us">
        <p className="crm-section-label">GLANCE</p>
        <h2>Why you choose us ?</h2>
        <p className="crm-subtext">Our mission is to support you in achieving your goals.</p>
        <div className="crm-cards">
          <div className="crm-card">
            <div className="crm-icon">🖥</div>
            <h4>Responsive and Accessible</h4>
            <p>Lorem ipsum dolor sit, amet consectetur adipisicing elit. Dolor sit, amet consectetur.</p>
            <button className="crm-read-more">Read More →</button>
          </div>
          <div className="crm-card">
            <div className="crm-icon pink">🔁</div>
            <h4>Continuous Updates and Support</h4>
            <p>Lorem ipsum dolor sit, amet consectetur adipisicing elit. Dolor sit, amet consectetur.</p>
            <button className="crm-read-more">Read More →</button>
          </div>
          <div className="crm-card">
            <div className="crm-icon rose">🎛</div>
            <h4>Design and Customization</h4>
            <p>Lorem ipsum dolor sit, amet consectetur adipisicing elit. Dolor sit, amet consectetur.</p>
            <button className="crm-read-more">Read More →</button>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Home;
