import React from "react";
import "../../styles/main/Testimonials.css"; // Add styles here
import clientImg from "/assets/main/client.jpg"; // Replace with actual image path

const Testimonials = () => {
  return (
    <div className="testimonials-container">
      <div className="testimonials-image">
        <img src={clientImg} alt="Happy Client" />
      </div>
      <div className="testimonials-content">
        <h2>
          What our <span className="highlight">Clients Say</span>
        </h2>
        <p className="testimonial-quote">
          “MF Global Services completely transformed our corporate gifting process. The quality,
          customization, and service are unmatched. Highly recommend!”
        </p>

        <div className="testimonial-item">
          <h3 className="testimonial-title">Exceptional Quality</h3>
          <p>
            Every gift was beautifully packed and branded. It made our brand look truly premium to our clients.
          </p>
        </div>

        <div className="testimonial-item">
          <h3 className="testimonial-title">Seamless Experience</h3>
          <p>
            From selection to delivery, everything was smooth and stress-free thanks to the MF Global team.
          </p>
        </div>

        <div className="testimonial-item">
          <h3 className="testimonial-title">Timely Delivery</h3>
          <p>
            On-time delivery made all the difference for our event launches and holiday campaigns.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Testimonials;
