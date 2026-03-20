import axios from 'axios';

const publicClient = axios.create({ baseURL: '/api' });

export default publicClient;
