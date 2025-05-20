import React from 'react'
import Navbar from "../../components/main/Navbar"
import WhyChooseUs from "../../components/main/WhyChooseUs"
import HeroSection from "../../components/main/HeroSection"
import Testimonials from "../../components/main/Testimonials"
import RaiseTheBar from "../../components/main/RaiseTheBar"
import OurServices from "../../components/main/OurServices"
import Footer from "../../components/main/Footer"

export const Mainhome = () => {
  return (
    <div>
          <Navbar/>
          <HeroSection/>
          <OurServices/>
          <RaiseTheBar />
          <Testimonials/>
          <WhyChooseUs/>
          <Footer/>
      </div>
  )
}

export default Mainhome;