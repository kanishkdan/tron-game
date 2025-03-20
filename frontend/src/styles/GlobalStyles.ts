import { createGlobalStyle } from 'styled-components';

export const GlobalStyles = createGlobalStyle`
  @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;500;600;700&display=swap');

  * {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
  }

  body {
    font-family: 'Orbitron', sans-serif;
    background: #000;
    color: #0fbef2;
    line-height: 1.5;
    overflow: hidden;
  }

  #root {
    height: 100vh;
    width: 100vw;
  }

  /* Custom scrollbar */
  ::-webkit-scrollbar {
    width: 8px;
    height: 8px;
  }

  ::-webkit-scrollbar-track {
    background: rgba(15, 190, 242, 0.1);
  }

  ::-webkit-scrollbar-thumb {
    background: #0fbef2;
    border-radius: 4px;
  }

  ::-webkit-scrollbar-thumb:hover {
    background: rgba(15, 190, 242, 0.8);
  }

  /* Selection color */
  ::selection {
    background: rgba(15, 190, 242, 0.3);
    color: #fff;
  }
`; 