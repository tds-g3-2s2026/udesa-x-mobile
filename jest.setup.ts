import { configure } from '@testing-library/react-native';

// The first test of a file runs while Jest is still compiling it, and on a cold
// CI runner that can take longer than the default one second of findBy*.
configure({ asyncUtilTimeout: 10000 });
