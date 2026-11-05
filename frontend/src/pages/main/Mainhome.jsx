import React from 'react'
import Navbar from "../../components/main/Navbar"
import WhyChooseUs from "../../components/main/WhyChooseUs"
import HeroSection from "../../components/main/HeroSection"
import Testimonials from "../../components/main/Testimonials"
import RaiseTheBar from "../../components/main/RaiseTheBar"
import OurServices from "../../components/main/OurServices"
import Footer from "../../components/main/Footer"
import PopularCategories from '../../components/main/PopularCategories'
import OurProcess from '../../components/main/OurProcess'
import useMarketingMeta from "./useMarketingMeta";
import "../../styles/main/MarketingSite.css";

export const Mainhome = () => {
  useMarketingMeta(
    "MF Global Services | Corporate Gifting & Digital Solutions",
    "Explore corporate gifting, digital marketing, and website development solutions from MF Global Services."
  );

  return (
    <div className="marketing-site">
          <Navbar/>
          <main>
          <HeroSection/>
          
          <OurServices/>
          <Testimonials/>
          <PopularCategories/>
          <OurProcess/>
          
          <RaiseTheBar />
          
          <WhyChooseUs/>
          </main>
          <Footer/>
      </div>
  )
}

export default Mainhome;