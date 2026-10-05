import "@testing-library/jest-dom";

// jsdom kent window.scrollTo niet (alleen een foutmelding in de log)
window.scrollTo = () => {};
