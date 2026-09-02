import React, { useRef, useEffect } from "react";
import { Code, Calculator, BookOpen, PenTool, TrendingUp } from "lucide-react";
import PropTypes from 'prop-types';

// =============================
// DONNÉES
// =============================
const capabilities = [
  {
    id: "programming",
    icon: Code,
    title: "Programmation",
    desc: "Génération de code, APIs, SaaS",
  },
  {
    id: "accounting",
    icon: Calculator,
    title: "Comptabilité OHADA",
    desc: "Exercices, journaux comptables",
  },
  {
    id: "science",
    icon: BookOpen,
    title: "Sciences",
    desc: "Physique, chimie, biologie",
  },
  {
    id: "writing",
    icon: PenTool,
    title: "Rédaction",
    desc: "Analyse et création de texte",
  },
  {
    id: "business",
    icon: TrendingUp,
    title: "Business",
    desc: "Business plan et stratégie",
  },
];

// =============================
// COMPOSANT PRINCIPAL
// =============================
const CapabilitiesSection = () => {
  const sectionRef = useRef(null);

  // Animation au scroll (simple fade-in)
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("opacity-100", "translate-y-0");
            entry.target.classList.remove("opacity-0", "translate-y-10");
          }
        });
      },
      { threshold: 0.1 }
    );

    if (sectionRef.current) {
      observer.observe(sectionRef.current);
    }

    return () => {
      if (sectionRef.current) {
        observer.unobserve(sectionRef.current);
      }
    };
  }, []);

  return (
    <div
      ref={sectionRef}
      className="opacity-0 translate-y-10 transition-all duration-700"
    >
      <h2 className="text-3xl font-bold text-center mb-10 text-gray-900 dark:text-white">
        Compétences de KIRIX
      </h2>

      <div className="grid md:grid-cols-3 gap-6">
        {capabilities.map((cap) => (
          <div
            key={cap.id}
            className="
              bg-white dark:bg-gray-800 
              rounded-2xl shadow-lg p-6 
              hover:shadow-xl hover:-translate-y-1 
              transition-all duration-300
              border border-gray-100 dark:border-gray-700
            "
            role="article"
            aria-label={`Capacité: ${cap.title}`}
          >
            <cap.icon
              className="w-10 h-10 text-indigo-600 dark:text-indigo-400 mb-4"
              aria-hidden="true"
            />
            <h3 className="font-bold text-lg text-gray-900 dark:text-white mb-2">
              {cap.title}
            </h3>
            <p className="text-gray-600 dark:text-gray-300 text-sm leading-relaxed">
              {cap.desc}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
};

CapabilitiesSection.propTypes = {};

export default CapabilitiesSection;
