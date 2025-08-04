import os
import platform

def clear_screen():
    """Clear the terminal screen."""
    if platform.system() == "Windows":
        os.system('cls')
    else:
        os.system('clear')

def parse_algebraic(move_str: str) -> str:
    """
    Parse algebraic notation to internal format.
    Examples:
    - e2e4 -> e2e4
    - Nf3 -> g1f3
    - O-O -> e1g1
    """
    # For now, just return the move as-is
    # Full algebraic notation parsing would be more complex
    return move_str.lower()

def get_square_notation(row: int, col: int) -> str:
    """Convert row, col to chess notation."""
    if 0 <= row < 8 and 0 <= col < 8:
        return f"{chr(ord('a') + col)}{row + 1}"
    return None

def display_board_simple(board_str: str) -> None:
    """Display board in a simple format."""
    print("\n" + board_str + "\n")