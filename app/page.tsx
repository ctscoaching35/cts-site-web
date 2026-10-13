import Nav from '@/components/Nav';
import Hero from '@/components/Hero';
import Problem from '@/components/Problem';
import About from '@/components/About';
import Offer from '@/components/Offer';
import BlocPlans from '@/components/BlocPlans';
import Testimonials from '@/components/Testimonials';
import Instagram from '@/components/Instagram';
import Contact from '@/components/Contact';
import Footer from '@/components/Footer';

export default function HomePage() {
  return (
    <>
      <Nav />
      <main>
        <Hero />
        <Problem />
        <About />
        <Offer />
        <BlocPlans />
        <Testimonials />
        <Instagram />
        <Contact />
      </main>
      <Footer />
    </>
  );
}
