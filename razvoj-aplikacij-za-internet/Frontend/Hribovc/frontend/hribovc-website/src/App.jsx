import { BrowserRouter, Routes, Route } from "react-router-dom";
import Home from "./pages/Home";
import Plan from "./pages/Plan";
import ScraperTest from "./pages/ScraperTest";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/plan" element={<Plan />} />
        <Route path="/scraper-test" element={<ScraperTest />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;