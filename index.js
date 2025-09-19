// Global variables
let currentCities = [];

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
      )}&count=5&language=en&format=json`
    );

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();

    if (data.results && data.results.length > 0) {
      currentCities = data.results;
      displaySuggestions(data.results);
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

function displaySuggestions(cities) {
  const suggestionsHTML = cities
    .map((city, index) => {
      return `
                        <div class="suggestion-item" onclick="selectCityByIndex(${index})">
                            <div class="city-name">${city.name}</div>
                            <div class="country-name">${
                              city.country || city.admin1 || ""
                            }</div>
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
  let resultText, resultClass, iconHtml, detailText;

  if (precipitation > 50) {
    resultText = "YES";
    resultClass = "yes";
    iconHtml = '<i class="fas fa-cloud-rain"></i>';
    detailText = `High chance of rain (${precipitation}%) today in ${location}. Don't forget your umbrella!`;
  } else if (precipitation > 20) {
    resultText = "MAYBE";
    resultClass = "maybe";
    iconHtml = '<i class="fas fa-cloud-sun"></i>';
    detailText = `${precipitation}% chance of rain today in ${location}. You might need an umbrella.`;
  } else {
    resultText = "NO";
    resultClass = "no";
    iconHtml = '<i class="fas fa-sun"></i>';
    detailText = `Low chance of rain (${precipitation}%) today in ${location}. Enjoy your day!`;
  }

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
