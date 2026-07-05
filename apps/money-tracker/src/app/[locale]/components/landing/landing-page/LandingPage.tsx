import type { FC } from 'react';

import { AdvantagesSection } from '../advantages-section/AdvantagesSection';
import { FaqSection } from '../faq-section/FaqSection';
import { FooterSection } from '../footer-section/FooterSection';
import { HeroSection } from '../hero-section/HeroSection';
import { ReviewsSection } from '../reviews-section/ReviewsSection';
import styles from './LandingPage.module.scss';

export const LandingPage: FC = () => (
  <div className={styles.landing}>
    <HeroSection />
    <AdvantagesSection />
    <ReviewsSection />
    <FaqSection />
    <FooterSection />
  </div>
);
