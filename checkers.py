"""
Checkers — Object-Oriented Pygame Implementation with Minimax & MCTS AI.
Developed by: Md. Safiul Islam & Md. Mesbaul Islam
"""

import pygame as pg
from sys import exit, argv
from pygame.locals import *
from board_gui import BoardGUI
from game_control import GameControl

def main(gamemode, ai_algo="minimax", white_algo="minimax", black_algo="mcts"):
    # Main setup
    pg.init()
    FPS = 30
    PLAYER_COLOR = "W"

    DISPLAYSURF = pg.display.set_mode((700, 500))
    pg.display.set_caption('Checkers in Python')
    fps_clock = pg.time.Clock()
    game_control = None

    # Creates a GameControl with specified AI algorithm(s) for the computer modes.
    if gamemode == "cpu":
        game_control = GameControl(PLAYER_COLOR, True, False, ai_algorithm=ai_algo)
    elif gamemode == "ai":
        game_control = GameControl(PLAYER_COLOR, False, True, white_ai_algorithm=white_algo, black_ai_algorithm=black_algo)
        pg.time.set_timer(USEREVENT, 400)
    else:
        game_control = GameControl(PLAYER_COLOR, False)

    # Font setup
    main_font = pg.font.SysFont("Arial", 24, bold=True)
    sub_font = pg.font.SysFont("Arial", 15)
    algo_font = pg.font.SysFont("Arial", 16, bold=True)
    turn_rect = (505, 20)
    algo_label_rect = (505, 58)
    algo_val_rect = (505, 78)
    matchup_rect = (505, 105)
    winner_rect = (505, 145)

    while True:
        # GUI
        DISPLAYSURF.fill((20, 26, 22))
        game_control.draw_screen(DISPLAYSURF)

        # Turn indicator
        turn_display_text = "White's turn" if game_control.get_turn() == "W" else "Black's turn"
        DISPLAYSURF.blit(main_font.render(turn_display_text, True, (255, 255, 255)), turn_rect)

        # Algorithm indicator
        DISPLAYSURF.blit(sub_font.render("Active Algorithm:", True, (160, 175, 165)), algo_label_rect)
        algo_name = game_control.get_current_algorithm_name()
        DISPLAYSURF.blit(algo_font.render(algo_name, True, (120, 225, 160)), algo_val_rect)

        # Matchup description
        matchup_desc = game_control.get_matchup_description()
        DISPLAYSURF.blit(sub_font.render(matchup_desc, True, (190, 200, 195)), matchup_rect)

        if game_control.get_winner() is not None:
            winner_display_text = "White wins!" if game_control.get_winner() == "W" else "Black wins!"
            DISPLAYSURF.blit(main_font.render(winner_display_text, True, (255, 215, 0)), winner_rect)

        # Event handling
        for event in pg.event.get():
            if event.type == QUIT:
                pg.quit()
                return
            
            if event.type == MOUSEBUTTONDOWN:
                game_control.hold_piece(event.pos)
            
            if event.type == MOUSEBUTTONUP:
                game_control.release_piece()

                if game_control.get_turn() != PLAYER_COLOR and gamemode == "cpu":
                    pg.time.set_timer(USEREVENT, 400)
            
            if event.type == USEREVENT:
                # AI movement
                if game_control.get_winner() is not None:
                    if gamemode == "ai":
                        pg.time.set_timer(USEREVENT, 0)
                    continue

                game_control.move_ai()

                if game_control.get_turn() == PLAYER_COLOR and gamemode == "cpu":
                    pg.time.set_timer(USEREVENT, 0)
        
        pg.display.update()
        fps_clock.tick(FPS)

if __name__ == '__main__':
    if len(argv) < 2:
        print("Usage: python checkers.py <mode> [ai_algo] [black_algo]")
        print("Modes: pvp, cpu [minimax|mcts], ai [white_algo] [black_algo]")
        print("Example: python checkers.py cpu mcts")
        print("Example: python checkers.py ai minimax mcts")
    else:
        mode = argv[1].lower()
        if mode == "pvp":
            main("pvp")
        elif mode == "cpu":
            algo = argv[2].lower() if len(argv) > 2 and argv[2].lower() in ["minimax", "mcts"] else "minimax"
            main("cpu", ai_algo=algo)
        elif mode == "ai":
            w_algo = argv[2].lower() if len(argv) > 2 and argv[2].lower() in ["minimax", "mcts"] else "minimax"
            b_algo = argv[3].lower() if len(argv) > 3 and argv[3].lower() in ["minimax", "mcts"] else "mcts"
            main("ai", white_algo=w_algo, black_algo=b_algo)
        else:
            print(f"Unknown game mode '{argv[1]}'. Use 'pvp', 'cpu', or 'ai'.")
    
    exit()