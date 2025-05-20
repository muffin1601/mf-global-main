import { createSlice } from '@reduxjs/toolkit';

// Get user from localStorage initially
const userData = localStorage.getItem('user');

const initialState = {
  isLoggedIn: !!userData,
  user: userData ? JSON.parse(userData) : null,
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    loginSuccess: (state, action) => {
      state.isLoggedIn = true;
      state.user = action.payload;

      // Store user in localStorage
      localStorage.setItem('user', JSON.stringify(action.payload));
    },

    logout: (state) => {
      state.isLoggedIn = false;
      state.user = null;

      // Clear localStorage
      localStorage.removeItem('token');
      localStorage.removeItem('user');
    },
  },
});

export const { loginSuccess, logout } = authSlice.actions;
export default authSlice.reducer;
