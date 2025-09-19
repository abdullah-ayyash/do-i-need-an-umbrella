// Global variables
let currentCities = [];
let currentAnimation = null;
let weatherCache = new Map();
let locationCache = new Map();

// Cache duration (10 minutes for weather, 1 hour for geocoding)
const WEATHER_CACHE_DURATION = 10 * 60 * 1000; // 10 minutes
const LOCATION_CACHE_DURATION = 60 * 60 * 1000; // 1 hour

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

// Cache utilities
function getCacheKey(lat, lon) {
  return `${Math.round(lat * 100) / 100}_${Math.round(lon * 100) / 100}`;
}

function isCacheValid(timestamp, duration) {
  return Date.now() - timestamp < duration;
}

// Background switching function
function setWeatherBackground(animationType) {
  const body = document.body;
  body.classList.remove("rainy-bg", "sunny-bg", "cloudy-bg");

  switch (animationType) {
    case "rain":
      body.classList.add("rainy-bg");
      break;
    case "sun":
      body.classList.add("sunny-bg");
      break;
    case "clouds":
      body.classList.add("cloudy-bg");
      break;
  }
}

// Initialize the app
document.addEventListener("DOMContentLoaded", function () {
  loading.style.display = "block";
  locationPrompt.style.display = "none";
  requestLocation();

  checkBtn.addEventListener("click", getWeatherByCity);
  cityInput.addEventListener("keypress", function (e) {
    if (e.key === "Enter") {
      getWeatherByCity();
    }
  });

  cityInput.addEventListener("input", function (e) {
    const query = e.target.value;
    if (!query.trim()) {
      suggestions.classList.add("hidden");
      currentCities = [];
      return;
    }
    debouncedSearch(query);
  });

  cityInput.addEventListener("focus", function () {
    const query = this.value.trim();
    if (query.length >= 2 && currentCities.length > 0) {
      suggestions.classList.remove("hidden");
    }
  });

  document.addEventListener("click", function (e) {
    if (!inputSection.contains(e.target)) {
      suggestions.classList.add("hidden");
    }
  });
});

// Weather animation functions
function createWeatherAnimation(type) {
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

function createRainAnimation(container) {
  const rainContainer = document.createElement("div");
  rainContainer.className = "rain";
  container.appendChild(rainContainer);

  for (let i = 0; i < 80; i++) {
    const drop = document.createElement("div");
    drop.className = "drop";
    drop.style.left = `${Math.random() * 100}%`;
    drop.style.top = `-20px`;
    drop.style.animationDelay = `${Math.random() * 2}s`;
    drop.style.animationDuration = `${1 + Math.random() * 0.5}s`;
    rainContainer.appendChild(drop);
  }
}

function createSunAnimation(container) {
  const sun = document.createElement("div");
  sun.className = "sun";
  container.appendChild(sun);

  for (let i = 0; i < 12; i++) {
    const ray = document.createElement("div");
    ray.className = "sun-ray";
    ray.style.transform = `rotate(${i * 30}deg)`;
    container.appendChild(ray);
  }
}

function createCloudsAnimation(container) {
  const cloudsContainer = document.createElement("div");
  cloudsContainer.className = "clouds";
  container.appendChild(cloudsContainer);

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
        loading.style.display = "block";
        locationPrompt.style.display = "none";
        getWeatherByCoords(position.coords.latitude, position.coords.longitude);
      },
      function (error) {
        loading.style.display = "none";
        locationPrompt.style.display = "none";
        permissionDenied.style.display = "block";
        inputSection.style.display = "block";
        result.style.display = "none";
      },
      { timeout: 5000, enableHighAccuracy: false }
    );
  } else {
    loading.style.display = "none";
    locationPrompt.style.display = "none";
    permissionDenied.innerHTML =
      '<p><i class="fas fa-exclamation-circle"></i> Geolocation is not supported by your browser. Please enter your city manually.</p>';
    permissionDenied.style.display = "block";
    inputSection.style.display = "block";
    result.style.display = "none";
  }
}

// Optimized weather fetching with caching
async function getWeatherByCoords(lat, lon) {
  const cacheKey = getCacheKey(lat, lon);
  const cached = weatherCache.get(cacheKey);

  // Check if we have valid cached data
  if (cached && isCacheValid(cached.timestamp, WEATHER_CACHE_DURATION)) {
    console.log("Using cached weather data");
    displayResult(cached.data, "your location");
    loading.style.display = "none";
    return;
  }

  try {
    // Optimized API call - only get what we need
    const response = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=precipitation_probability_max&timezone=auto&forecast_days=1`,
      {
        signal: AbortSignal.timeout(8000),
      }
    );

    if (!response.ok) {
      throw new Error("Weather data not available");
    }

    const data = await response.json();
    const maxPrecipitation = data.daily.precipitation_probability_max[0];

    // Cache the result
    weatherCache.set(cacheKey, {
      data: maxPrecipitation,
      timestamp: Date.now(),
    });

    // Clean old cache entries periodically
    if (weatherCache.size > 50) {
      const now = Date.now();
      for (let [key, value] of weatherCache.entries()) {
        if (!isCacheValid(value.timestamp, WEATHER_CACHE_DURATION)) {
          weatherCache.delete(key);
        }
      }
    }

    displayResult(maxPrecipitation, "your location");
  } catch (error) {
    console.error("Error fetching weather data:", error);
    displayError();
  } finally {
    loading.style.display = "none";
  }
}

// Optimized city weather fetching
async function getWeatherByCity() {
  const cityName = cityInput.value.trim();

  if (!cityName) {
    showError("Please enter a city name");
    return;
  }

  if (currentCities.length > 0) {
    const city = currentCities[0];
    selectCity(city.latitude, city.longitude, city.name);
    return;
  }

  loading.style.display = "block";
  result.style.display = "none";

  // Check location cache first
  const locationCacheKey = cityName.toLowerCase();
  const cachedLocation = locationCache.get(locationCacheKey);

  if (
    cachedLocation &&
    isCacheValid(cachedLocation.timestamp, LOCATION_CACHE_DURATION)
  ) {
    console.log("Using cached location data");
    getWeatherByCoords(
      cachedLocation.data.latitude,
      cachedLocation.data.longitude
    );
    return;
  }

  try {
    const geoResponse = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
        cityName
      )}&count=1&language=en&format=json`,
      {
        signal: AbortSignal.timeout(5000),
      }
    );

    if (!geoResponse.ok) {
      throw new Error(`Geocoding failed: ${geoResponse.status}`);
    }

    const geoData = await geoResponse.json();

    if (geoData.results && geoData.results.length > 0) {
      const location = geoData.results[0];

      // Cache the location result
      locationCache.set(locationCacheKey, {
        data: location,
        timestamp: Date.now(),
      });

      getWeatherByCoords(location.latitude, location.longitude);
    } else {
      showError("City not found. Please try another city name.");
      loading.style.display = "none";
    }
  } catch (error) {
    console.error("Geocoding error:", error);
    showError("Unable to find city. Please try again.");
    loading.style.display = "none";
  }
}

// Optimized city search with caching
async function searchCities(query) {
  const trimmedQuery = query.trim();

  if (trimmedQuery.length < 2) {
    suggestions.classList.add("hidden");
    currentCities = [];
    return;
  }

  // Check cache for city search
  const searchCacheKey = `search_${trimmedQuery.toLowerCase()}`;
  const cachedSearch = locationCache.get(searchCacheKey);

  if (
    cachedSearch &&
    isCacheValid(cachedSearch.timestamp, LOCATION_CACHE_DURATION)
  ) {
    const filteredResults = filterCitySuggestions(
      cachedSearch.data,
      trimmedQuery
    );
    currentCities = filteredResults;
    if (filteredResults.length > 0) {
      displaySuggestions(filteredResults);
    } else {
      suggestions.classList.add("hidden");
    }
    return;
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);

    const response = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
        trimmedQuery
      )}&count=10&language=en&format=json`,
      { signal: controller.signal }
    );

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();

    if (data.results && data.results.length > 0) {
      // Cache search results
      locationCache.set(searchCacheKey, {
        data: data.results,
        timestamp: Date.now(),
      });

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
    if (error.name === "AbortError") {
      console.log("Search request timed out");
    } else {
      console.error("Search error:", error);
    }
    currentCities = [];
    suggestions.classList.add("hidden");
  }
}

// Rest of functions remain the same...
function filterCitySuggestions(results, query) {
  return results
    .filter((city) => {
      if (
        city.feature_code &&
        (city.feature_code === "PCLI" ||
          city.feature_code === "PCLD" ||
          city.feature_code === "PCL" ||
          city.feature_code === "PCLS" ||
          city.feature_code === "TERR")
      ) {
        return false;
      }

      const isLikelyCountryQuery =
        query.length > 5 &&
        [
          "australia",
          "canada",
          "germany",
          "france",
          "italy",
          "spain",
          "japan",
          "brazil",
          "india",
          "china",
        ].includes(query.toLowerCase());

      if (
        isLikelyCountryQuery &&
        city.name.toLowerCase() === query.toLowerCase() &&
        city.country &&
        city.country.toLowerCase() !== query.toLowerCase()
      ) {
        return false;
      }

      if (
        city.feature_code &&
        (city.feature_code === "PPL" ||
          city.feature_code === "PPLA" ||
          city.feature_code === "PPLA2" ||
          city.feature_code === "PPLA3" ||
          city.feature_code === "PPLA4" ||
          city.feature_code === "PPLC")
      ) {
        return true;
      }

      if (
        city.feature_code &&
        (city.feature_code === "ADM2" ||
          city.feature_code === "ADM3" ||
          city.feature_code === "ADM4")
      ) {
        return true;
      }

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

  // Set background and create animation
  setWeatherBackground(animationType);
  createWeatherAnimation(animationType);

  result.innerHTML = `
    <div class="icon">${iconHtml}</div>
    <div class="answer">${resultText}</div>
    <div class="details">${detailText}</div>
  `;

  result.className = `result ${resultClass}`;
  result.style.display = "block";
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
  result.innerHTML = `<div class="error">${message}</div>`;
  result.style.display = "block";
}

const debouncedSearch = debounce(searchCities, 300);
