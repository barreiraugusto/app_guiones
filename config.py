import os

class Config:
    SQLALCHEMY_DATABASE_URI = 'sqlite:///textos.db'
    SQLALCHEMY_TRACK_MODIFICATIONS = False