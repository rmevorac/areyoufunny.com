export default function PrivacyPage() {
  return (
    <div className="container mx-auto px-4 py-8 text-gray-800">
      <h1 className="text-3xl font-bold mb-6 text-center text-gray-900">Privacy Policy</h1>
      {/* TODO: Update placeholder effective date */}
      <p className="mb-6 text-sm text-gray-600 text-center">
        Effective Date: May 18, 2025
      </p>
      <p className="mb-6 text-lg">
        At areufunny.com (the "Site"), we value your privacy. This policy outlines what information we collect and how we use it.
      </p>

      <div className="space-y-6">
        <section>
          <h2 className="text-2xl font-semibold mb-3 text-gray-900">1. Information We Collect</h2>
          <p className="mb-2 leading-relaxed">
            We collect the following types of information:
          </p>
          <ul className="list-disc list-inside mb-4 pl-4 space-y-1 leading-relaxed">
            <li><strong>IP Address:</strong> For security, analytics, and to improve user experience.</li>
            <li><strong>Email Address:</strong> For account creation, communication, and occasional marketing updates (opt-out available).</li>
            <li><strong>User Content:</strong> Any content you upload to the Site, such as audio, video, images, and written material.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-3 text-gray-900">2. How We Use Your Information</h2>
          <p className="mb-2 leading-relaxed">
            Your information is used for the following purposes:
          </p>
          <ul className="list-disc list-inside mb-4 pl-4 space-y-1 leading-relaxed">
            <li>To operate and maintain the Site.</li>
            <li>To communicate with you regarding your account or content.</li>
            <li>To promote user-generated content across our marketing channels (with appropriate credit where applicable).</li>
          </ul>
          <p className="mb-4 leading-relaxed">
            We do not sell or share your personal information with third parties, except as required by law.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-3 text-gray-900">3. Cookies and Tracking</h2>
          {/* TODO: Consider making this section more specific if cookies are actively used (e.g., for session, analytics, cookie banner consent) */}
          <p className="mb-4 leading-relaxed">
            We may use cookies and similar tracking technologies to enhance user experience, analyze site traffic, and for other operational purposes.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-3 text-gray-900">4. Your Rights and Choices</h2>
          <p className="mb-4 leading-relaxed">
            You can opt out of marketing communications at any time by clicking the "unsubscribe" link provided in our emails or by contacting us directly.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-3 text-gray-900">5. Data Security</h2>
          <p className="mb-4 leading-relaxed">
            We implement standard security measures to protect your personal information. However, please be aware that no method of transmission over the internet or method of electronic storage is 100% secure.
          </p>
        </section>
        
        <section>
          <h2 className="text-2xl font-semibold mb-3 text-gray-900">6. Changes to This Privacy Policy</h2>
          <p className="mb-4 leading-relaxed">
            We may update our Privacy Policy from time to time. We will notify you of any changes by posting the new Privacy Policy on this page. You are advised to review this Privacy Policy periodically for any changes.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-3 text-gray-900">7. Contact Us</h2>
          <p className="mb-4 leading-relaxed">
            If you have any questions about this Privacy Policy, please contact us at: <a href="mailto:funny@areufunny.com" className="text-red-600 hover:text-red-700 underline">funny@areufunny.com</a>.
          </p>
        </section>
      </div>

      {/* TODO: Update placeholder last updated date */}
      <p className="mt-10 text-sm text-gray-500 text-center">
        Last updated: May 18, 2025
      </p>
    </div>
  );
} 