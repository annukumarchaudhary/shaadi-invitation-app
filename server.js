const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const mongoose = require('mongoose');

const app = express();
const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/shaadi-app';

mongoose.connect(MONGODB_URI)
  .then(() => console.log('MongoDB connected successfully'))
  .catch(err => console.error('MongoDB connection error:', err));

// ✨ FIXED Database Schema: Added guests count parameter with explicit default value to 1
const relativeSchema = new mongoose.Schema({
  name: { type: String, required: true },
  address: { type: String, required: true }, 
  phone: { type: String, default: '' }, 
  guests: { type: Number, default: 1 }, // Default configuration ensures legacy 220 records auto-assign to 1
  receivedAt: { type: Date, default: Date.now }
});
const Relative = mongoose.model('Relative', relativeSchema);

app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/get-all', async (req, res) => {
	try {
		const relatives = await Relative.find().sort({ receivedAt: -1 });
		res.json(relatives);
	} catch (err) {
		res.status(500).json({ error: err.message });
	}
});

app.post('/api/add-relative', async (req, res) => {
	const { name, address, phone = '', guests = 1 } = req.body || {};
	if (!name || !address) {
		return res.status(400).json({ error: 'Invalid payload. Name and Address are required.' });
	}
	try {
		const entry = await Relative.create({ name, address, phone, guests: parseInt(guests) || 1 });
		res.status(201).json({ success: true, entry });
	} catch (err) {
		res.status(400).json({ error: err.message });
	}
});

app.get('/api/find', async (req, res) => {
	const queryValue = req.query.query || req.query.location; 
	const searchType = req.query.type || 'address'; 
	if (!queryValue) {
		return res.status(400).json({ error: 'Search query parameter is required' });
	}
	try {
		let mongoQuery = {};
		if (searchType === 'name') {
			mongoQuery = { name: { $regex: queryValue, $options: 'i' } };
		} else {
			mongoQuery = { address: { $regex: queryValue, $options: 'i' } };
		}
		const people = await Relative.find(mongoQuery).sort({ name: 1 });
		res.json(people);
	} catch (err) {
		res.status(500).json({ error: err.message });
	}
});

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin';
function adminAuth(req, res, next) {
	const pass = req.get('x-admin-password') || req.query.adminPassword || '';
	if (pass !== ADMIN_PASSWORD) {
		return res.status(401).json({ error: 'Unauthorized. Admin password mismatch.' });
	}
	next();
}

app.get('/rsvps', async (req, res) => {
	try {
		const relatives = await Relative.find().sort({ receivedAt: -1 });
		const formatted = relatives.map(r => ({
			id: r._id,
			name: r.name,
			attending: r.address, 
			guests: r.guests || 1, // Correct parameter synchronization context maps back to table rows     
			message: r.phone || 'N/A', // Shifted phone number inside message field matrix
			receivedAt: r.receivedAt ? new Date(r.receivedAt).toLocaleString('en-IN') : 'N/A' 
		}));
		res.json(formatted);
	} catch (err) {
		res.status(500).json({ error: err.message });
	}
});

app.delete('/rsvp/:id', adminAuth, async (req, res) => {
	try {
		const removed = await Relative.findByIdAndDelete(req.params.id);
		if (!removed) return res.status(404).json({ error: 'Not found' });
		res.json({ success: true, removed });
	} catch (err) {
		res.status(500).json({ error: err.message });
	}
});

app.put('/rsvp/:id', adminAuth, async (req, res) => {
	try {
		const { name, attending, guests, message } = req.body || {};
		
		const updates = {};
		if (name !== undefined) updates.name = name;
		if (attending !== undefined) updates.address = attending; 
		if (guests !== undefined) updates.guests = parseInt(guests) || 1; // Handled guests update context modification layer
		if (message !== undefined) updates.phone = (message === 'N/A' ? '' : message); 

		const entry = await Relative.findByIdAndUpdate(req.params.id, updates, { new: true });
		if (!entry) return res.status(404).json({ error: 'Record not found' });
		
		res.json({ success: true, entry });
	} catch (err) {
		res.status(500).json({ error: err.message });
	}
});

app.post('/rsvps/clear', adminAuth, async (req, res) => {
	try {
		await Relative.deleteMany({});
		res.json({ success: true });
	} catch (err) {
		res.status(500).json({ error: err.message });
	}
});

app.use((req, res) => {
	res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

mongoose.connection.once('open', () => {
	app.listen(PORT, () => {
		console.log(`Server listening on http://localhost:${PORT}`);
	});
});