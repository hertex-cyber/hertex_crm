"""Identity API routes."""

from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import AuthViewSet, UserViewSet

router = DefaultRouter(trailing_slash=False)
router.register(r"", AuthViewSet, basename="auth")

user_router = DefaultRouter(trailing_slash=False)
user_router.register(r"", UserViewSet, basename="user")

urlpatterns = [
    path("register", AuthViewSet.as_view({"post": "register"}), name="auth-register"),
    path("login", AuthViewSet.as_view({"post": "login"}), name="auth-login"),
    path("refresh", AuthViewSet.as_view({"post": "refresh"}), name="auth-refresh"),
    path("logout", AuthViewSet.as_view({"post": "logout"}), name="auth-logout"),
    path("me", AuthViewSet.as_view({"get": "me", "put": "me"}), name="auth-me"),
    path("forgot-password", AuthViewSet.as_view({"post": "forgot_password"}), name="auth-forgot-password"),
    path("reset-password", AuthViewSet.as_view({"post": "reset_password"}), name="auth-reset-password"),
]

urlpatterns += router.urls
urlpatterns += [path("users/", include(user_router.urls))]
