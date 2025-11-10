import cron from 'node-cron';
import ItemTransferService from './itemTransferService.js'; // Adjust path

// Schedule to run every day at 2:00 AM
cron.schedule('0 2 * * *', async () => {
  console.log(`⏰ Starting daily item sync at ${new Date().toLocaleString()}`);
  try {
    const result = await ItemTransferService.transferAllItems();
    // console.log('✅ Daily item sync completed:', result);
  } catch (err) {
    console.error('❌ Daily item sync failed:', err.message || err);
  }
});

// cron.schedule('*/10 * * * * *', async () => {
//   console.log(`⏰ Starting item sync at ${new Date().toLocaleString()}`);
//   try {
//     const result = await ItemTransferService.transferAllItems();
//     console.log('✅ Item sync completed:', result);
//   } catch (err) {
//     console.error('❌ Item sync failed:', err.message || err);
//   }
// }, {
//   scheduled: true,
//   timezone: "UTC" // or your preferred timezone
// });
