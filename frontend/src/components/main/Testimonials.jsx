import React from 'react';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Autoplay, Pagination } from 'swiper/modules';
import 'swiper/css';
import 'swiper/css/pagination';
import '../../styles/main/Testimonials.css';

const testimonials = [
  {
    quote:
      "We’ve never had corporate gifting run this smoothly before! The MF Global Services team handled our Diwali gifting campaign for over 700 employees across multiple locations with incredible efficiency.",
    name: "Riya S.",
    position: "HR at XYZ Tech",
    image: "/assets/main/1 (1).jpg"
  },
  {
    quote:
      "The eco-friendly welcome kits were a big hit with our new joiners. Not only was the branding spot on, but the quality reflected our sustainability values perfectly.",
    name: "Arjun K.",
    position: "Procurement Head",
    image:  "/assets/main/1 (3).jpg"
  },
  {
    quote:
      "Our onboarding kits were beautifully packed and delivered on time, creating an exceptional first impression for our new employees.",
    name: "Sneha M.",
    position: "People Ops at FinGro",
    image:  "/assets/main/1 (2).jpg"
  },
  {
    quote:
      "We were super impressed with how premium our custom gifting sets looked. Clients were genuinely delighted—it added real value to our campaign.",
    name: "Rajiv P.",
    position: "Manager at Omega Corp",
    image:  "/assets/main/1 (4).jpg"
  }
];



const Testimonials = () => {
  return (
    <section className="testimonial-wrapper">
      <div className="testimonial-content">
        <h2 className="testimonial-heading">What Our Clients Say</h2>
        <p className="testimonial-subheading">
          Trusted by leading brands for employee gifting, festive kits, and corporate events.
        </p>

        <Swiper
          modules={[Autoplay, Pagination]}
          spaceBetween={30}
          slidesPerView={3}
          autoplay={{ delay: 3000 }}
          loop={true}
          breakpoints={{
            320: { slidesPerView: 1 },
            768: { slidesPerView: 2 },
            1024: { slidesPerView: 3 },
          }}
          pagination={{ clickable: true }}
        >
          {testimonials.map((item, index) => (
            <SwiperSlide key={index}>
              <div className="testimonial-card">
                <p className="testimonial-quote">“{item.quote}”</p>
                <img className="testimonial-img" src={item.image} alt={item.name} />
                <p className="testimonial-author">— {item.name}, <span>{item.position}</span></p>
              </div>
            </SwiperSlide>
          ))}
        </Swiper>
      </div>
    </section>
  );
};

export default Testimonials;
