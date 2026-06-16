"""
Tests for the CoordinateService — pure math, no database needed.

These tests validate the core coordinate transformation and geometry
functions. Since CoordinateService has no external dependencies,
all tests are synchronous and fast to run.
"""

import pytest

from app.services.coordinate import CoordinateService


class TestValidateRect:
    """Tests for CoordinateService.validate_rect."""

    def test_valid_rect(self):
        """A rectangle with 2 valid points should pass."""
        assert CoordinateService.validate_rect(
            [[0.1, 0.1], [0.3, 0.3]]
        ) is True

    def test_too_few_points(self):
        """A rect with fewer than 2 points should be rejected."""
        assert CoordinateService.validate_rect(
            [[0.1, 0.1]]
        ) is False

    def test_too_many_points(self):
        """A rect with more than 2 points should be rejected."""
        assert CoordinateService.validate_rect(
            [[0.1, 0.1], [0.2, 0.2], [0.3, 0.3]]
        ) is False

    def test_empty(self):
        """An empty point list should be rejected."""
        assert CoordinateService.validate_rect([]) is False

    def test_x_out_of_range(self):
        """A point with x > 1.0 should be rejected."""
        assert CoordinateService.validate_rect(
            [[1.5, 0.1], [0.2, 0.2]]
        ) is False

    def test_y_out_of_range(self):
        """A point with y < 0.0 should be rejected."""
        assert CoordinateService.validate_rect(
            [[0.1, -0.1], [0.2, 0.2]]
        ) is False

    def test_malformed_point(self):
        """A point with only one coordinate should be rejected."""
        assert CoordinateService.validate_rect(
            [[0.1], [0.2, 0.2]]
        ) is False

    def test_boundary_values(self):
        """Points exactly at 0.0 and 1.0 boundaries should pass."""
        assert CoordinateService.validate_rect(
            [[0.0, 0.0], [1.0, 1.0]]
        ) is True


class TestBoundingBox:
    """Tests for CoordinateService.bounding_box."""

    def test_simple_rect(self):
        """Bounding box of a rectangle should match expected values."""
        bbox = CoordinateService.bounding_box(
            [[0.1, 0.1], [0.5, 0.4]]
        )
        assert bbox["x_min"] == 0.1
        assert bbox["x_max"] == 0.5
        assert bbox["y_min"] == 0.1
        assert bbox["y_max"] == 0.4
        assert bbox["width"] == pytest.approx(0.4)
        assert bbox["height"] == pytest.approx(0.3)


class TestNormalizeDenormalize:
    """Tests for coordinate normalize/denormalize round-trip."""

    def test_round_trip(self):
        """Normalizing then denormalizing should return the original value."""
        page_w, page_h = 612, 792
        pixel_x, pixel_y = 150.0, 300.0

        norm_x = CoordinateService.normalize(pixel_x, page_w)
        norm_y = CoordinateService.normalize(pixel_y, page_h)
        assert abs(norm_x - 150 / 612) < 0.001
        assert abs(norm_y - 300 / 792) < 0.001

        round_x = CoordinateService.denormalize(norm_x, page_w)
        round_y = CoordinateService.denormalize(norm_y, page_h)
        assert abs(round_x - pixel_x) < 0.001
        assert abs(round_y - pixel_y) < 0.001

    def test_zero_dimension(self):
        """Normalizing with a zero dimension should return 0.0."""
        assert CoordinateService.normalize(100, 0) == 0.0
