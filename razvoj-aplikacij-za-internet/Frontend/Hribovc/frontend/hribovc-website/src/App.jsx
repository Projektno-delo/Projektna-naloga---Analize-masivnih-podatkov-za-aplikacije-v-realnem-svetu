import { BrowserRouter, Routes, Route } from "react-router-dom";
import Home from "./pages/Home";
import Plan from "./pages/Plan";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/plan" element={<Plan />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;