"""
Coordinate service — pure geometry and validation utilities.

This is the most critical module in the entire application. All coordinate
transformations happen here. The service enforces the normalized coordinate
contract (0.0 to 1.0) that makes annotations resolution-independent and
zoom-safe. Every function is a pure static method with no side effects,
making them trivially testable in isolation.
"""


class CoordinateService:
    """
    Static methods for rectangle validation and coordinate transformation.

    All coordinates are stored and validated in normalized space (0-1),
    decoupling annotations from screen resolution, zoom level, and device.
    Rectangles are stored as 2 points: [top-left, bottom-right].
    """

    @staticmethod
    def validate_rect(points: list[list[float]]) -> bool:
        """
        Validate that points form a valid normalized rectangle.

        A valid rectangle must have:
            - Exactly 2 points (top-left, bottom-right).
            - Each point with exactly 2 coordinates.
            - Each coordinate in the [0.0, 1.0] range.

        Args:
            points: Array of [x, y] coordinate pairs, exactly 2.

        Returns:
            True if the rectangle is valid, False otherwise.
        """
        if len(points) != 2:
            return False
        for point in points:
            if len(point) != 2:
                return False
            x, y = point
            if not (0.0 <= x <= 1.0 and 0.0 <= y <= 1.0):
                return False
        return True

    @staticmethod
    def bounding_box(points: list[list[float]]) -> dict:
        """
        Compute the axis-aligned bounding box of a rectangle.

        Used for label placement.

        Args:
            points: Array of 2 normalized [x, y] (top-left, bottom-right).

        Returns:
            Dict with keys: x_min, x_max, y_min, y_max, width, height.
        """
        xs = [p[0] for p in points]
        ys = [p[1] for p in points]
        return {
            "x_min": min(xs),
            "x_max": max(xs),
            "y_min": min(ys),
            "y_max": max(ys),
            "width": max(xs) - min(xs),
            "height": max(ys) - min(ys),
        }

    @staticmethod
    def normalize(pixel: float, dimension: float) -> float:
        """
        Convert a pixel coordinate to normalized space (0 to 1).

        Args:
            pixel: The pixel coordinate value.
            dimension: The page dimension (width or height) in pixels.

        Returns:
            A float in the range [0.0, 1.0], or 0.0 if dimension is zero.
        """
        if dimension == 0:
            return 0.0
        return pixel / dimension

    @staticmethod
    def denormalize(value: float, dimension: float) -> float:
        """
        Convert a normalized coordinate back to pixel space.

        Args:
            value: Normalized coordinate in range [0.0, 1.0].
            dimension: The page dimension (width or height) in pixels.

        Returns:
            The pixel coordinate value.
        """
        return value * dimension
