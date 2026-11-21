"""
Checkers Artificial Intelligence — Minimax with Alpha-Beta Pruning & MCTS.
Developed by: Md. Safiul Islam & Md. Mesbaul Islam
"""

import math
from board import Board
from copy import deepcopy
from random import choice

class _MCTSNode:
	def __init__(self, board, turn, parent=None, move=None):
		self.board = board
		self.turn = turn
		self.parent = parent
		self.move = move
		self.children = []
		self.visits = 0
		self.wins = 0.0
		self.untried_moves = None

	def get_untried_moves(self, ai_helper):
		if self.untried_moves is None:
			self.untried_moves = ai_helper._legal_moves(self.board, self.turn)
		return self.untried_moves

	def is_fully_expanded(self, ai_helper):
		return len(self.get_untried_moves(ai_helper)) == 0

	def best_child(self, c=1.414):
		log_n = math.log(max(1, self.visits))
		best_node = None
		best_val = -float('inf')
		for child in self.children:
			val = (child.wins / child.visits) + c * math.sqrt(log_n / child.visits)
			if val > best_val:
				best_val = val
				best_node = child
		return best_node

class AI:
	def __init__(self, color, algorithm="minimax"):
		self.color = color
		self.algorithm = algorithm

	def get_algorithm_name(self):
		if self.algorithm.lower() == "mcts":
			return "MCTS"
		return "Minimax (Alpha-Beta)"

	def _legal_moves(self, board, color):
		moves = []
		for index, piece in enumerate(board.get_pieces()):
			if piece.get_color() != color:
				continue
			for move in piece.get_moves(board):
				moves.append({"piece": index, "move": move})

		jump_moves = [move for move in moves if move["move"]["eats_piece"]]
		return jump_moves if jump_moves else moves

	def _next_board(self, board, move):
		new_board = Board(deepcopy(board.get_pieces()), board.get_color_up())
		new_board.move_piece(move["piece"], int(move["move"]["position"]))
		return new_board

	def minimax(self, current_board, is_maximizing, depth, turn, alpha=-999, beta=999):
		if depth == 0 or current_board.get_winner() is not None:
			return self.get_value(current_board)

		moves = self._legal_moves(current_board, turn)
		if not moves:
			return self.get_value(current_board)

		next_turn = "B" if turn == "W" else "W"
		if is_maximizing:
			best_value = -999
			for move in moves:
				value = self.minimax(self._next_board(current_board, move), False, depth - 1, next_turn, alpha, beta)
				best_value = max(best_value, value)
				alpha = max(alpha, best_value)
				if beta <= alpha:
					break
			return best_value

		best_value = 999
		for move in moves:
			value = self.minimax(self._next_board(current_board, move), True, depth - 1, next_turn, alpha, beta)
			best_value = min(best_value, value)
			beta = min(beta, best_value)
			if beta <= alpha:
				break
		return best_value

	def monte_carlo_score(self, board, turn, simulations=4, rollout_depth=5):
		"""Estimate a tied move with short random playouts from the position."""
		score = 0
		for _ in range(simulations):
			rollout_board = Board(deepcopy(board.get_pieces()), board.get_color_up())
			rollout_turn = turn
			for _ in range(rollout_depth):
				if rollout_board.get_winner() is not None:
					break
				moves = self._legal_moves(rollout_board, rollout_turn)
				if not moves:
					score += 1 if rollout_turn != self.color else -1
					break
				rollout_board = self._next_board(rollout_board, choice(moves))
				rollout_turn = "B" if rollout_turn == "W" else "W"

			winner = rollout_board.get_winner()
			if winner == self.color:
				score += 1
			elif winner is not None:
				score -= 1
		return score

	def minimax_move(self, current_board):
		possible_moves = self._legal_moves(current_board, self.color)
		if not possible_moves:
			return None

		next_turn = "W" if self.color == "B" else "B"
		move_scores = []
		alpha = -999
		for move in possible_moves:
			aux_board = self._next_board(current_board, move)
			score = self.minimax(aux_board, False, 3, next_turn, alpha, 999)
			move_scores.append(score)
			alpha = max(alpha, score)

		best_score = max(move_scores)
		best_moves = [move for index, move in enumerate(possible_moves) if move_scores[index] == best_score]
		if len(best_moves) > 1:
			rollout_scores = [self.monte_carlo_score(self._next_board(current_board, move), next_turn) for move in best_moves]
			best_rollout = max(rollout_scores)
			best_moves = [move for index, move in enumerate(best_moves) if rollout_scores[index] == best_rollout]

		move_chosen = choice(best_moves)
		piece = current_board.get_pieces()[move_chosen["piece"]]
		return {"position_to": move_chosen["move"]["position"], "position_from": piece.get_position()}

	def mcts_move(self, current_board, iterations=180, rollout_depth=10):
		possible_moves = self._legal_moves(current_board, self.color)
		if not possible_moves:
			return None
		if len(possible_moves) == 1:
			move_chosen = possible_moves[0]
			piece = current_board.get_pieces()[move_chosen["piece"]]
			return {"position_to": move_chosen["move"]["position"], "position_from": piece.get_position()}

		root = _MCTSNode(current_board, self.color)

		for _ in range(iterations):
			node = root

			# 1. Selection
			while not node.board.get_winner() and node.is_fully_expanded(self) and node.children:
				node = node.best_child()

			# 2. Expansion
			untried = node.get_untried_moves(self)
			if not node.board.get_winner() and untried:
				move = untried.pop()
				next_board = self._next_board(node.board, move)
				next_turn = "W" if node.turn == "B" else "B"
				child = _MCTSNode(next_board, next_turn, parent=node, move=move)
				node.children.append(child)
				node = child

			# 3. Rollout / Simulation
			rollout_board = Board(deepcopy(node.board.get_pieces()), node.board.get_color_up())
			rollout_turn = node.turn
			winner = rollout_board.get_winner()

			if winner is None:
				for _ in range(rollout_depth):
					moves = self._legal_moves(rollout_board, rollout_turn)
					if not moves:
						winner = "W" if rollout_turn == "B" else "B"
						break
					rollout_board = self._next_board(rollout_board, choice(moves))
					rollout_turn = "W" if rollout_turn == "B" else "B"
					winner = rollout_board.get_winner()
					if winner is not None:
						break

			if winner == self.color:
				outcome = 1.0
			elif winner is not None:
				outcome = 0.0
			else:
				val = self.get_value(rollout_board)
				outcome = 1.0 if val > 0 else (0.0 if val < 0 else 0.5)

			# 4. Backpropagation
			curr = node
			while curr is not None:
				curr.visits += 1
				curr.wins += outcome
				curr = curr.parent

		if not root.children:
			move_chosen = choice(possible_moves)
		else:
			best_child = max(root.children, key=lambda c: c.visits)
			move_chosen = best_child.move

		piece = current_board.get_pieces()[move_chosen["piece"]]
		return {"position_to": move_chosen["move"]["position"], "position_from": piece.get_position()}

	def get_move(self, current_board):
		if self.algorithm.lower() == "mcts":
			return self.mcts_move(current_board)
		return self.minimax_move(current_board)

	def get_value(self, board):
		winner = board.get_winner()
		if winner is not None:
			return 2 if winner == self.color else -2

		player_pieces = sum(piece.get_color() == self.color for piece in board.get_pieces())
		opponent_pieces = len(board.get_pieces()) - player_pieces
		if player_pieces == opponent_pieces:
			return 0
		return 1 if player_pieces > opponent_pieces else -1
