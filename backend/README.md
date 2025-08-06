# Netflix Movie Recommender System

A comprehensive AI-powered movie recommendation system that provides personalized Netflix movie suggestions using multiple recommendation approaches.

## Features

- **Content-Based Filtering**: Find movies similar to your favorites
- **Collaborative Filtering**: Get recommendations based on user behavior
- **Hybrid AI**: Combine multiple approaches for better recommendations
- **Interactive Web Interface**: Beautiful, responsive UI
- **Real-time Recommendations**: Instant suggestions based on your preferences

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd netflix-recommender
```

2. Install dependencies:
```bash
pip install -r requirements.txt
```

3. Run the application:
```bash
python app.py
```

4. Open your browser and navigate to `http://localhost:5000`

## Usage

### Content-Based Recommendations
Enter a movie title you like, and the system will find similar movies based on genre, description, and cast.

### Collaborative Filtering
Enter a user ID to get recommendations based on what similar users have enjoyed.

### Hybrid AI Recommendations
Select your preferred genres, minimum rating, and year range to get personalized AI-powered recommendations.

## API Endpoints

- `GET /api/movies` - Get all available movies
- `GET /api/genres` - Get available genres
- `GET /api/recommend/content?movie_title=<title>&n=5` - Content-based recommendations
- `GET /api/recommend/collaborative?user_id=1&n=5` - Collaborative filtering recommendations
- `POST /api/recommend/hybrid` - Hybrid AI recommendations

## Technology Stack

- **Backend**: Flask, Python
- **Frontend**: HTML5, CSS3, JavaScript
- **Machine Learning**: scikit-learn, pandas, numpy
- **Recommendation Algorithms**: TF-IDF, Cosine Similarity, SVD

## Project Structure

```
netflix-recommender/
├── app.py                 # Flask application
├── recommender.py         # Core recommendation engine
├── requirements.txt       # Python dependencies
├── templates/            # HTML templates
│   └── index.html
├── static/              # Static files
│   ├── css/
│   │   └── style.css
│   └── js/
│       └── app.js
├── data/                # Data files (auto-generated)
├── models/              # Saved models
└── README.md
```

## Development

To add new features or modify the recommendation system:

1. Update the `NetflixRecommender` class in `recommender.py`
2. Add new API endpoints in `app.py`
3. Update the frontend in `static/js/app.js`
4. Test with synthetic data before using real Netflix data

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is for educational purposes. Please respect Netflix's terms of service when using real data.