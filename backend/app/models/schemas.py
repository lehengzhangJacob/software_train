from typing import Literal

from pydantic import BaseModel, Field


MealType = Literal["breakfast", "lunch", "dinner", "snack"]
Gender = Literal["male", "female", "other"]
ActivityLevel = Literal[
    "sedentary",
    "lightly_active",
    "moderately_active",
    "very_active",
    "extra_active",
]
Intensity = Literal["low", "moderate", "high"]


class ProfileOut(BaseModel):
    user_id: int
    username: str
    gender: Gender
    age: int
    height_cm: float
    weight_kg: float
    daily_calorie_target: int
    daily_protein_target: float
    daily_fat_target: float
    daily_carbs_target: float
    bmr: float | None = None
    activity_level: ActivityLevel
    created_at: str | None = None
    updated_at: str | None = None


class ProfileUpdate(BaseModel):
    username: str | None = None
    gender: Gender | None = None
    age: int | None = Field(default=None, gt=0, lt=150)
    height_cm: float | None = Field(default=None, gt=0)
    weight_kg: float | None = Field(default=None, gt=0)
    daily_calorie_target: int | None = Field(default=None, gt=0)
    daily_protein_target: float | None = Field(default=None, ge=0)
    daily_fat_target: float | None = Field(default=None, ge=0)
    daily_carbs_target: float | None = Field(default=None, ge=0)
    activity_level: ActivityLevel | None = None


class MealOut(BaseModel):
    record_id: int
    user_id: int
    food_name: str
    meal_type: MealType
    calories: float
    protein_g: float
    fat_g: float
    carbs_g: float
    portion_desc: str | None = None
    photo_path: str | None = None
    recognition_raw: str | None = None
    record_date: str
    record_time: str
    notes: str | None = None
    created_at: str | None = None


class MealCreate(BaseModel):
    food_name: str
    meal_type: MealType
    calories: float = Field(ge=0)
    protein_g: float = Field(default=0, ge=0)
    fat_g: float = Field(default=0, ge=0)
    carbs_g: float = Field(default=0, ge=0)
    portion_desc: str | None = None
    photo_path: str | None = None
    recognition_raw: str | None = None
    record_date: str | None = None
    record_time: str | None = None
    notes: str | None = None
    user_id: int | None = None


class MealUpdate(BaseModel):
    food_name: str | None = None
    meal_type: MealType | None = None
    calories: float | None = Field(default=None, ge=0)
    protein_g: float | None = Field(default=None, ge=0)
    fat_g: float | None = Field(default=None, ge=0)
    carbs_g: float | None = Field(default=None, ge=0)
    portion_desc: str | None = None
    notes: str | None = None
    record_date: str | None = None
    record_time: str | None = None


class FoodItem(BaseModel):
    name: str
    portion: str = ""
    calories: float = 0
    protein: float = 0
    fat: float = 0
    carbs: float = 0
    confidence: float | None = None


class RecognizeResponse(BaseModel):
    foods: list[FoodItem]
    total_calories: float = 0
    model: str
    raw_text: str
    photo_path: str | None = None
    parse_ok: bool = True


class DailyNutrition(BaseModel):
    user_id: int
    username: str | None = None
    record_date: str
    total_calories: float = 0
    total_protein_g: float = 0
    total_fat_g: float = 0
    total_carbs_g: float = 0
    meal_count: int = 0
    daily_calorie_target: int = 2000
    daily_protein_target: float = 60
    daily_fat_target: float = 60
    daily_carbs_target: float = 250
    calorie_diff: float = 0


class ExerciseSuggestionOut(BaseModel):
    suggestion_id: int
    user_id: int
    suggestion_date: str
    calorie_surplus: float | None = None
    exercise_type: str
    duration_minutes: int
    calorie_burn_estimate: float
    intensity: Intensity | None = None
    suggestion_detail: str | None = None
    is_adopted: int = 0
    created_at: str | None = None


class ExerciseGenerateRequest(BaseModel):
    user_id: int | None = None
    date: str | None = None


class AdoptRequest(BaseModel):
    is_adopted: int = Field(ge=0, le=1)
