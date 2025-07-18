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

export const Mainhome = () => {
  return (
    <div>
          <Navbar/>
          <HeroSection/>
          
          <OurServices/>
          <Testimonials/>
          <PopularCategories/>
          <OurProcess/>
          
          <RaiseTheBar />
          
          <WhyChooseUs/>
          <Footer/>
      </div>
  )
}

export default Mainhome;