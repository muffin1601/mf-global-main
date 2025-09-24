import { createSlice } from '@reduxjs/toolkit';


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

     
      localStorage.setItem('user', JSON.stringify(action.payload));
    },

    logout: (state) => {
      state.isLoggedIn = false;
      state.user = null;

      
      localStorage.removeItem('token');
      localStorage.removeItem('user');
    },
  },
});

export const { loginSuccess, logout } = authSlice.actions;
export default authSlice.reducer;
