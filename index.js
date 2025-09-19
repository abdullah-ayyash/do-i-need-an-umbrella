// Global variables
let currentCities = [];
let currentAnimation = null;

// DOM elements
const loading = document.getElementById("loading");
const locationPrompt = document.getElementById("location-prompt");
const permissionDenied = document.getElementById("permission-denied");
const inputSection = document.getElementById("input-section");
const checkBtn = document.getElementById("check-btn");
const cityInput = document.getElementById("city-input");
const suggestions = document.getElementById("suggestions");
const result = document.getElementById("result");

// Debounce function for better performance
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// Initialize the app
document.addEventListener("DOMContentLoaded", function () {
  // Show location prompt and request location
  loading.style.display = "block";
  locationPrompt.style.display = "none";
  requestLocation();

  // Set up event listeners
  checkBtn.addEventListener("click", getWeatherByCity);
  cityInput.addEventListener("keypress", function (e) {
    if (e.key === "Enter") {
      getWeatherByCity();
    }
  });

  // City input event listeners for suggestions
  cityInput.addEventListener("input", function (e) {
    const query = e.target.value;

    // Immediate feedback for empty input
    if (!query.trim()) {
      suggestions.classList.add("hidden");
      currentCities = [];
      return;
    }

    // Use debounced search for actual queries
    debouncedSearch(query);
  });

  cityInput.addEventListener("focus", function () {
    const query = this.value.trim();
    if (query.length >= 2 && currentCities.length > 0) {
      suggestions.classList.remove("hidden");
    }
  });

  // Hide suggestions when focus is lost
  document.addEventListener("click", function (e) {
    if (!inputSection.contains(e.target)) {
      suggestions.classList.add("hidden");
    }
  });
});

// Create weather animation based on precipitation
function createWeatherAnimation(type) {
  // Remove any existing animation
  removeWeatherAnimation();

  const animationContainer = document.createElement("div");
  animationContainer.className = "weather-animation";
  document.body.appendChild(animationContainer);
  currentAnimation = animationContainer;

  if (type === "rain") {
    createRainAnimation(animationContainer);
  } else if (type === "sun") {
    createSunAnimation(animationContainer);
  } else if (type === "clouds") {
    createCloudsAnimation(animationContainer);
  }
}

// Create rain animation
function createRainAnimation(container) {
  const rainContainer = document.createElement("div");
  rainContainer.className = "rain";
  container.appendChild(rainContainer);

  // Create raindrops
  for (let i = 0; i < 80; i++) {
    const drop = document.createElement("div");
    drop.className = "drop";
    drop.style.left = `${Math.random() * 100}%`;
    drop.style.animationDelay = `${Math.random() * 2}s`;
    drop.style.animationDuration = `${1 + Math.random() * 0.5}s`;
    rainContainer.appendChild(drop);
  }
}

// Create sun animation
function createSunAnimation(container) {
  const sun = document.createElement("div");
  sun.className = "sun";
  container.appendChild(sun);

  // Create sun rays
  for (let i = 0; i < 12; i++) {
    const ray = document.createElement("div");
    ray.className = "sun-ray";
    ray.style.transform = `rotate(${i * 30}deg)`;
    container.appendChild(ray);
  }
}

// Create clouds animation
function createCloudsAnimation(container) {
  const cloudsContainer = document.createElement("div");
  cloudsContainer.className = "clouds";
  container.appendChild(cloudsContainer);

  // Create clouds
  for (let i = 0; i < 6; i++) {
    const cloud = document.createElement("div");
    cloud.className = "cloud";
    cloud.style.width = `${60 + Math.random() * 80}px`;
    cloud.style.height = `${40 + Math.random() * 40}px`;
    cloud.style.top = `${Math.random() * 80}%`;
    cloud.style.left = `${Math.random() * 20}%`;
    cloud.style.opacity = `${0.3 + Math.random() * 0.4}`;
    cloud.style.animationDelay = `${Math.random() * 20}s`;
    cloud.style.animationDuration = `${20 + Math.random() * 40}s`;
    cloudsContainer.appendChild(cloud);
  }
}

// Remove weather animation
function removeWeatherAnimation() {
  if (currentAnimation) {
    document.body.removeChild(currentAnimation);
    currentAnimation = null;
  }
}

function requestLocation() {
  if ("geolocation" in navigator) {
    navigator.geolocation.getCurrentPosition(
      function (position) {
        // Successfully got location
        loading.style.display = "block";
        locationPrompt.style.display = "none";
        getWeatherByCoords(position.coords.latitude, position.coords.longitude);
      },
      function (error) {
        // Location access denied or error
        loading.style.display = "none";
        locationPrompt.style.display = "none";
        permissionDenied.style.display = "block";
        inputSection.style.display = "block";
        // Don't show any result initially
        result.style.display = "none";
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  } else {
    // Geolocation not supported
    loading.style.display = "none";
    locationPrompt.style.display = "none";
    permissionDenied.innerHTML =
      '<p><i class="fas fa-exclamation-circle"></i> Geolocation is not supported by your browser. Please enter your city manually.</p>';
    permissionDenied.style.display = "block";
    inputSection.style.display = "block";
    // Don't show any result initially
    result.style.display = "none";
  }
}

async function getWeatherByCoords(lat, lon) {
  try {
    // Fetch weather data from Open-Meteo API
    const response = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&hourly=precipitation_probability&daily=precipitation_probability_max&timezone=auto`
    );
    const data = await response.json();

    if (!response.ok) {
      throw new Error("Weather data not available");
    }

    // Get max precipitation probability for today
    const maxPrecipitation = data.daily.precipitation_probability_max[0];

    // Display result
    displayResult(maxPrecipitation, "your location");
  } catch (error) {
    console.error("Error fetching weather data:", error);
    displayError();
  } finally {
    loading.style.display = "none";
  }
}

async function getWeatherByCity() {
  const cityName = cityInput.value.trim();

  if (!cityName) {
    showError("Please enter a city name");
    return;
  }

  // If there are current city suggestions, use the first one
  if (currentCities.length > 0) {
    const city = currentCities[0];
    selectCity(city.latitude, city.longitude, city.name);
    return;
  }

  loading.style.display = "block";
  result.style.display = "none";

  try {
    const geoResponse = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
        cityName
      )}&count=1&language=en&format=json`
    );
    const geoData = await geoResponse.json();

    if (geoData.results && geoData.results.length > 0) {
      const { latitude, longitude, name } = geoData.results[0];
      getWeatherByCoords(latitude, longitude);
    } else {
      showError("City not found. Please try another city name.");
    }
  } catch (error) {
    showError("Unable to find city. Please try again.");
  }
}

async function searchCities(query) {
  const trimmedQuery = query.trim();

  if (trimmedQuery.length < 2) {
    suggestions.classList.add("hidden");
    currentCities = [];
    return;
  }

  try {
    const response = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
        trimmedQuery
      )}&count=10&language=en&format=json`
    );

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();

    if (data.results && data.results.length > 0) {
      // Filter out inappropriate results
      const filteredResults = filterCitySuggestions(data.results, trimmedQuery);
      currentCities = filteredResults;

      if (filteredResults.length > 0) {
        displaySuggestions(filteredResults);
      } else {
        currentCities = [];
        suggestions.classList.add("hidden");
      }
    } else {
      currentCities = [];
      suggestions.classList.add("hidden");
    }
  } catch (error) {
    console.error("Search error:", error);
    currentCities = [];
    suggestions.classList.add("hidden");
  }
}

// Filter out inappropriate city suggestions
// Filter out inappropriate city suggestions
function filterCitySuggestions(results, query) {
  return results
    .filter((city) => {
      // Filter out countries when searching for cities
      if (
        city.feature_code &&
        (city.feature_code === "PCLI" || // Independent political entity (country)
          city.feature_code === "PCLD" || // Dependent political entity
          city.feature_code === "PCL" || // Political entity (general)
          city.feature_code === "PCLS" || // Semi-independent political entity
          city.feature_code === "TERR") // Territory
      ) {
        return false;
      }

      // Only apply the "same name, different country" filter for country names
      // This prevents cases like "Australia" in Mexico, but allows "Richmond" in any country
      const isLikelyCountryQuery =
        query.length > 5 &&
        (query.toLowerCase() === "australia" ||
          query.toLowerCase() === "canada" ||
          query.toLowerCase() === "germany" ||
          query.toLowerCase() === "france" ||
          query.toLowerCase() === "italy" ||
          query.toLowerCase() === "spain" ||
          query.toLowerCase() === "japan" ||
          query.toLowerCase() === "brazil" ||
          query.toLowerCase() === "india" ||
          query.toLowerCase() === "china");

      if (
        isLikelyCountryQuery &&
        city.name.toLowerCase() === query.toLowerCase() &&
        city.country &&
        city.country.toLowerCase() !== query.toLowerCase()
      ) {
        return false;
      }

      // Prioritize actual cities and populated places
      if (
        city.feature_code &&
        (city.feature_code === "PPL" || // Populated place
          city.feature_code === "PPLA" || // Seat of a first-order administrative division
          city.feature_code === "PPLA2" || // Seat of a second-order administrative division
          city.feature_code === "PPLA3" || // Seat of a third-order administrative division
          city.feature_code === "PPLA4" || // Seat of a fourth-order administrative division
          city.feature_code === "PPLC") // Capital of a political entity
      ) {
        return true;
      }

      // Include other relevant place types
      if (
        city.feature_code &&
        (city.feature_code === "ADM2" || // Second-order administrative division
          city.feature_code === "ADM3" || // Third-order administrative division
          city.feature_code === "ADM4") // Fourth-order administrative division
      ) {
        return true;
      }

      // Exclude other types of features
      return false;
    })
    .slice(0, 5);
}

function displaySuggestions(cities) {
  const suggestionsHTML = cities
    .map((city, index) => {
      const displayName = city.name;
      let displayLocation = "";

      if (city.admin1 && city.country) {
        displayLocation = `${city.admin1}, ${city.country}`;
      } else if (city.country) {
        displayLocation = city.country;
      }

      return `
        <div class="suggestion-item" onclick="selectCityByIndex(${index})">
          <div class="city-name">${displayName}</div>
          <div class="country-name">${displayLocation}</div>
        </div>
      `;
    })
    .join("");

  suggestions.innerHTML = suggestionsHTML;
  suggestions.classList.remove("hidden");
}

function selectCityByIndex(index) {
  if (currentCities[index]) {
    const city = currentCities[index];
    selectCity(city.latitude, city.longitude, city.name);
  }
}

function selectCity(lat, lon, name) {
  cityInput.value = name;
  suggestions.classList.add("hidden");
  loading.style.display = "block";
  result.style.display = "none";
  getWeatherByCoords(lat, lon);
}

function displayResult(precipitation, location) {
  let resultText, resultClass, iconHtml, detailText, animationType;

  if (precipitation > 50) {
    resultText = "YES";
    resultClass = "yes";
    iconHtml = '<i class="fas fa-cloud-rain"></i>';
    detailText = `High chance of rain (${precipitation}%) today in ${location}. Don't forget your umbrella!`;
    animationType = "rain";
  } else if (precipitation > 20) {
    resultText = "MAYBE";
    resultClass = "maybe";
    iconHtml = '<i class="fas fa-cloud-sun"></i>';
    detailText = `${precipitation}% chance of rain today in ${location}. You might need an umbrella.`;
    animationType = "clouds";
  } else {
    resultText = "NO";
    resultClass = "no";
    iconHtml = '<i class="fas fa-sun"></i>';
    detailText = `Low chance of rain (${precipitation}%) today in ${location}. Enjoy your day!`;
    animationType = "sun";
  }

  // Create weather animation
  createWeatherAnimation(animationType);

  // Update the result display
  result.innerHTML = `
    <div class="icon">${iconHtml}</div>
    <div class="answer">${resultText}</div>
    <div class="details">${detailText}</div>
  `;

  result.className = `result ${resultClass}`;
  result.style.display = "block";

  // Update page title with result
  document.title = `${resultText} - Umbrella?`;
}

function displayError() {
  result.innerHTML = `
    <div class="icon"><i class="fas fa-exclamation-triangle"></i></div>
    <div class="answer">ERROR</div>
    <div class="details">Could not fetch weather data. Please try again later.</div>
  `;
  result.className = "result maybe";
  result.style.display = "block";
}

function showError(message) {
  result.innerHTML = `
    <div class="error">${message}</div>
  `;
  result.style.display = "block";
}

// Create debounced search function
const debouncedSearch = debounce(searchCities, 150);
