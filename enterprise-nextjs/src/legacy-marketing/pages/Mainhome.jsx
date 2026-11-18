"use client";
import React from 'react'
import Navbar from "../components/Navbar"
import WhyChooseUs from "../components/WhyChooseUs"
import HeroSection from "../components/HeroSection"
import Testimonials from "../components/Testimonials"
import RaiseTheBar from "../components/RaiseTheBar"
import OurServices from "../components/OurServices"
import Footer from "../components/Footer"
import PopularCategories from '../components/PopularCategories'
import OurProcess from '../components/OurProcess'
import useMarketingMeta from "./useMarketingMeta";
import "../styles/MarketingSite.css";

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