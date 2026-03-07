const bcrypt = require('bcryptjs');

async function test() {
    const password = 'password123';
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(password, salt);
    console.log('Hash:', hash);
    const isValid = await bcrypt.compare(password, hash);
    console.log('Is Valid:', isValid);
    
    // Test with a known hash format if possible
    // Wait, let's just use what's in use
}

test();
