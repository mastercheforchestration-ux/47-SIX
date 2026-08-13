import React, { useEffect } from 'react';

function App() {
  useEffect(() => {
    fetch('/')
      .then(res => res.text())
      .then(data => console.log(data));
  }, []);

  return (
    <div>
      <h1>React Frontend Connected to Express Backend</h1>
    </div>
  );
}

export default App;
